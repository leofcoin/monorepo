import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ContractMessage } from '@leofcoin/messages'
import { CodecHash } from '@leofcoin/codec-format-interface'
import { assertHashFormatState, PROTOCOL_VERSION } from '../../exports/hash-format-state.js'
import { migrateGenesisHashes } from '../../../../scripts/migrate-genesis-hashes.js'

const store = (values = {}) => ({
  has: async (key) => Object.hasOwn(values, key),
  get: async (key) => new TextEncoder().encode(values[key])
})

test('monorepo resolves a single registry codec and peernet 2.x graph', async () => {
  const lock = JSON.parse(await readFile(new URL('../../../../package-lock.json', import.meta.url), 'utf8'))
  for (const dependency of ['@leofcoin/codec-format-interface', '@leofcoin/peernet']) {
    const entries = Object.entries(lock.packages).filter(([name]) => name.endsWith(`/node_modules/${dependency}`) || name === `node_modules/${dependency}`)
    assert.equal(entries.length, 1, dependency)
    assert.equal(entries[0][1].version, '2.0.0', dependency)
    assert.ok(entries[0][1].resolved.startsWith('https://registry.npmjs.org/'), dependency)
  }
  for (const [name, entry] of Object.entries(lock.packages)) {
    assert.ok(!name.endsWith('/varint'), name)
    assert.ok(!/^(git\+|git:|github:|file:)/.test(entry.resolved ?? ''), name)
  }
})

test('canonical hash protocol accepts fresh/current roots and rejects old or unversioned state without writes', async () => {
  assert.equal(PROTOCOL_VERSION, '0.4.0')
  await assertHashFormatState(store())
  await assertHashFormatState(store({ version: '0.4.0', lastBlock: 'current' }))
  await assertHashFormatState(store({ version: '0.4.9' }))
  for (const version of ['0.3.0', '0.2.0', '1.0.0', '0.4.bad', 'not-a-version', '']) {
    await assert.rejects(assertHashFormatState(store({ version })), /incompatible with canonical hash protocol/)
  }
  await assert.rejects(assertHashFormatState(store({ lastBlock: 'old' })), /no protocol version/)
  await assert.rejects(assertHashFormatState(store(), store({ lastBlock: 'old' })), /no protocol version/)
  await assert.rejects(assertHashFormatState({ has: async () => { throw new Error('storage failure') } }), /storage failure/)
})

test('built Chain.ready rejects old protocol state before contract bootstrap', async () => {
  const { default: Chain } = await import('../../exports/chain.js')
  const previous = { chainStore: globalThis.chainStore, stateStore: globalThis.stateStore, contractStore: globalThis.contractStore }
  let bootstrapped = false
  try {
    globalThis.chainStore = store({ version: '0.3.0', lastBlock: 'preserve-old-tip' })
    globalThis.stateStore = store()
    globalThis.contractStore = { has: async () => { bootstrapped = true; throw new Error('bootstrap must not run') } }
    const chain = new Chain({})
    await assert.rejects(chain.ready, /incompatible with canonical hash protocol/)
    assert.equal(bootstrapped, false)
    assert.equal(new TextDecoder().decode(await globalThis.chainStore.get('version')), '0.3.0')
    assert.equal(new TextDecoder().decode(await globalThis.chainStore.get('lastBlock')), 'preserve-old-tip')
  } finally {
    Object.assign(globalThis, previous)
  }
})

test('bundled genesis contract addresses and constructor links match canonical hashes', async () => {
  const addresses = JSON.parse(await readFile(new URL('../../../addresses/src/addresses.json', import.meta.url), 'utf8'))
  const bytecodes = JSON.parse(await readFile(new URL('../../../lib/src/bytecodes.json', import.meta.url), 'utf8'))
  const messages = {}
  for (const [name, encoded] of Object.entries(bytecodes)) {
    const message = new ContractMessage(Uint8Array.from(encoded.split(',').map(Number)))
    messages[name] = message
    assert.equal(await message.hash(), addresses[name])
    const hash = new CodecHash()
    hash.fromBs32(addresses[name])
    assert.equal(hash.name, 'contract-message')
  }
  assert.equal(messages.contractFactory.decoded.constructorParameters[0], addresses.nativeToken)
  assert.equal(messages.validators.decoded.constructorParameters[0], addresses.nativeToken)
  assert.deepEqual(messages.nameService.decoded.constructorParameters.slice(0, 3), [addresses.contractFactory, addresses.nativeToken, addresses.validators])
  assert.deepEqual(await migrateGenesisHashes(addresses, bytecodes), { addresses, bytecodes })
})

test('public artifact migration preserves owner, contract code and native allocations', async () => {
  const addresses = { nativeToken: 'old-token', contractFactory: 'old-factory', validators: 'old-validators', nameService: 'old-names' }
  const params = {
    nativeToken: ['1000000', '50000', [{ address: 'original-owner', amount: '50000' }]],
    contractFactory: [addresses.nativeToken, '1000'],
    validators: [addresses.nativeToken],
    nameService: [addresses.contractFactory, addresses.nativeToken, addresses.validators, '1000']
  }
  const contract = new TextEncoder().encode('return class NativeContract {}')
  const bytecodes = Object.fromEntries(Object.keys(addresses).map((name) => [name, new ContractMessage({ creator: 'original-owner', contract, constructorParameters: params[name] }).toString()]))
  const before = structuredClone({ addresses, bytecodes })
  const result = await migrateGenesisHashes(addresses, bytecodes)
  for (const [name, encoded] of Object.entries(result.bytecodes)) {
    const message = new ContractMessage(Uint8Array.from(encoded.split(',').map(Number)))
    assert.equal(message.decoded.creator, 'original-owner')
    assert.deepEqual(message.decoded.contract, contract)
    assert.equal(await message.hash(), result.addresses[name])
    if (name === 'nativeToken') assert.deepEqual(message.decoded.constructorParameters, params.nativeToken)
  }
  assert.deepEqual({ addresses, bytecodes }, before)
  assert.deepEqual(await migrateGenesisHashes(result.addresses, result.bytecodes), result)
  await assert.rejects(migrateGenesisHashes({ ...addresses, extra: 'unexpected' }, bytecodes), /exactly the four/)
  await assert.rejects(migrateGenesisHashes({ ...addresses, validators: addresses.nativeToken }, bytecodes), /unique/)
})

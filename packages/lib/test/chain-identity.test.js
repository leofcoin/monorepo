import assert from 'node:assert/strict'
import test from 'node:test'
import bytecodes from '@leofcoin/lib/bytecodes.json' with { type: 'json' }
import addresses from '@leofcoin/addresses'
import { ContractMessage } from '@leofcoin/messages'
import { formatUnits } from '@leofcoin/utils'
import { createChainIdentity, verifyChainIdentity, findChainPresence } from '../exports/chain-identity.js'
import { createGenesisPlan, GENESIS_RUNTIME, GENESIS_PLAN_SCHEMA } from '../exports/genesis-plan.js'

test('planner construction and active bundled genesis have the exact same chain ID', async () => {
  const native = new ContractMessage(bytecodes.nativeToken).decoded
  const [target, initial, allocations] = native.constructorParameters
  const plan = await createGenesisPlan({
    schema: GENESIS_PLAN_SCHEMA, version: 1, label: 'Existing chain', ...GENESIS_RUNTIME,
    genesisValidator: native.creator, targetSupply: formatUnits(target), initialSupply: formatUnits(initial),
    allocations: allocations.map(entry => ({ address: entry.address, amount: formatUnits(entry.amount) })), stars: []
  })
  const identity = await createChainIdentity('leofcoin:peach', addresses)
  assert.equal(plan.chainId, identity.chainId)
  assert.deepEqual(await verifyChainIdentity(identity), identity)
  await assert.rejects(verifyChainIdentity({ ...identity, chainId: 'lfc:' + '0'.repeat(64) }), /does not match/)
  assert.notEqual((await createChainIdentity('another:chain', addresses)).chainId, identity.chainId)
})

test('discovery distinguishes announcements, non-observation and unavailable peers', async () => {
  const identity = await createChainIdentity('leofcoin:peach', addresses)
  const other = await createChainIdentity('another:chain', addresses)
  assert.equal((await findChainPresence(identity.chainId, ['p'], async () => identity)).status, 'found')
  assert.equal((await findChainPresence(identity.chainId, ['p'], async () => other)).status, 'not-observed')
  assert.equal((await findChainPresence(identity.chainId, [], async () => identity)).status, 'unknown')
  const partial = await findChainPresence(identity.chainId, ['working', 'old'], async id => {
    if (id === 'old') throw new Error('Unsupported request')
    return other
  })
  assert.equal(partial.status, 'unknown')
  assert.equal(partial.unavailablePeers, 1)
  assert.equal((await findChainPresence(identity.chainId, ['forged'], async () => ({ ...other, chainId: identity.chainId }))).status, 'unknown')
})

test('discovery is bounded, times out safely and ignores late responses', async () => {
  const identity = await createChainIdentity('leofcoin:peach', addresses)
  const calls = []
  const result = await findChainPresence(identity.chainId, Array.from({length:30}, (_,i) => String(i)), async id => {
    calls.push(id)
    return identity
  })
  assert.equal(calls.length, 16)
  assert.equal(result.checkedPeers, 16)
  let resolve
  const pending = new Promise(done => { resolve = done })
  const timeout = await findChainPresence(identity.chainId, ['slow'], () => pending, 5)
  assert.equal(timeout.status, 'unknown')
  resolve(identity)
  await Promise.resolve()
  assert.equal(timeout.status, 'unknown')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  GENESIS_PLAN_SCHEMA, GENESIS_RUNTIME, normalizeGenesisPlan, validateGenesisPlan, createGenesisPlan,
  serializeGenesisPlan, parseGenesisPlan, fingerprintGenesisPlan
} from '../exports/genesis-plan.js'

const owner = 'YTqyQkkaMKMTShz7LQh8XdxdZ2GPsXkd1bYHpqQWEF7tQyABZ9DGb'
const other = 'YTqzdvFjFnk7uX3tA54GaS1FyJXuAqRgnWZESKAsY19FDDDnHRdSN'
const definition = () => ({
  schema: GENESIS_PLAN_SCHEMA, version: 1, label: 'Offline fixture', ...GENESIS_RUNTIME,
  genesisValidator: owner, targetSupply: '1000', initialSupply: '100',
  allocations: [{ address: owner, amount: '40' }, { address: other, amount: '60' }],
  stars: ['wss://b.example', 'wss://a.example']
})
const basePlan = await createGenesisPlan(definition())
const fixture = () => structuredClone(basePlan)

test('validates accounts and produces canonical decimal values, ordering and fingerprints', async () => {
  const plan = fixture()
  const first = await validateGenesisPlan(plan)
  const reordered = { ...plan, initialSupply: '100.0000', allocations: [...plan.allocations].reverse(),
    stars: ['wss://a.example/', 'wss://b.example', 'wss://a.example'] }
  assert.equal(serializeGenesisPlan(first), serializeGenesisPlan(reordered))
  const fingerprint = await fingerprintGenesisPlan(first)
  assert.equal(fingerprint, await fingerprintGenesisPlan(reordered))
  assert.equal(fingerprint, createHash('sha256').update(serializeGenesisPlan(first)).digest('hex'))
  assert.deepEqual(parseGenesisPlan(serializeGenesisPlan(first)), first)
  assert.deepEqual(plan, fixture())
})

test('preserves precision beyond Number and down to one atomic unit', async () => {
  const plan = fixture()
  plan.targetSupply = '9007199254740994'
  plan.initialSupply = '9007199254740993.000000000000000001'
  plan.allocations = [{ address: owner, amount: '9007199254740993' }, { address: other, amount: '0.000000000000000001' }]
  assert.equal((await createGenesisPlan(plan)).initialSupply, plan.initialSupply)
  for (const value of [1, '1e3', '-1', '1,000', 'NaN', '01', '0.0000000000000000001'])
    assert.throws(() => normalizeGenesisPlan({ ...fixture(), initialSupply: value }))
})

test('chain IDs bind genesis values, ignore operator metadata and reject forged IDs', async () => {
  const original = fixture()
  const renamed = await createGenesisPlan({ ...original, label: 'Renamed', stars: [] })
  assert.equal(renamed.chainId, original.chainId)
  const changed = await createGenesisPlan({ ...original, targetSupply: '2000' })
  assert.notEqual(changed.chainId, original.chainId)
  await assert.rejects(validateGenesisPlan({ ...original, targetSupply: '2000' }), /does not match/)
  assert.throws(() => normalizeGenesisPlan({ ...original, chainId: 'manual-name' }), /Invalid chain ID/)
})

test('rejects incorrect totals, duplicate accounts, unfunded owners and unsupported runtimes', () => {
  const plan = fixture()
  assert.throws(() => normalizeGenesisPlan({ ...plan, initialSupply: '99' }), /must equal/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, initialSupply: '1001' }), /not exceed/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, allocations: [{address:owner,amount:'50'},{address:owner,amount:'50'}] }), /duplicate/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, allocations: [{address:other,amount:'100'}] }), /genesis validator/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, network: 'leofcoin:mainnet' }), /Unsupported network/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, protocolVersion: '9.0.0' }), /Unsupported protocol/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, token: { ...plan.token, decimals: 8 } }), /18 decimals/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, version: 2 }), /schema\/version/)
})

test('rejects secret fields and credential-bearing endpoints rather than silently dropping them', () => {
  const plan = fixture()
  for (const key of ['password', 'privateKey', 'mnemonic', '__proto__']) {
    const input = JSON.parse(JSON.stringify(plan))
    Object.defineProperty(input, key, { value: 'test-only', enumerable: true })
    assert.throws(() => normalizeGenesisPlan(input), /Never include secrets/)
  }
  assert.throws(() => normalizeGenesisPlan({ ...plan, token: { ...plan.token, privateKey: 'test-only' } }), /Unsupported token/)
  assert.throws(() => normalizeGenesisPlan({ ...plan, allocations: [{ ...plan.allocations[0], password: 'test-only' }] }), /Unsupported allocation/)
  for (const endpoint of ['ws://example.org', 'https://example.org', 'wss://user:pass@example.org', 'wss://example.org?token=x', 'wss://example.org#secret'])
    assert.throws(() => normalizeGenesisPlan({ ...plan, stars: [endpoint] }), /Bootstrap/)
})

test('allows offline plans; rejects corrupt accounts, malformed JSON and oversized imports', async () => {
  assert.deepEqual(normalizeGenesisPlan({ ...fixture(), stars: [] }).stars, [])
  const plan = fixture()
  plan.allocations[1].address = other.slice(0, -1) + (other.endsWith('1') ? '2' : '1')
  await assert.rejects(validateGenesisPlan(plan), /checksum\/key/)
  assert.throws(() => parseGenesisPlan('{invalid'), /valid JSON/)
  assert.throws(() => parseGenesisPlan(' '.repeat(1_048_577)), /size limit/)
})

test('CLI validates the same fingerprint without writing identity or chain data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'leofcoin-genesis-plan-'))
  const home = join(directory, 'empty-home')
  const cli = new URL('../../../scripts/validate-genesis-plan.js', import.meta.url).pathname
  try {
    await mkdir(home)
    const file = join(directory, 'plan.json')
    await writeFile(file, serializeGenesisPlan(fixture()))
    const options = { env: { ...process.env, HOME: home }, timeout: 10_000 }
    const { stdout } = await promisify(execFile)(process.execPath, [cli, file], options)
    const result = JSON.parse(stdout)
    assert.equal(result.valid, true)
    assert.equal(result.fingerprint, await fingerprintGenesisPlan(fixture()))
    assert.deepEqual(await readdir(home), [])
    await writeFile(file, JSON.stringify({ ...fixture(), password: 'test-only' }))
    await assert.rejects(promisify(execFile)(process.execPath, [cli, file], options), /Never include secrets/)
    assert.deepEqual(await readdir(home), [])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

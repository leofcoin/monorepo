import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const run = async (root, mode, invalid) => {
  try {
    return { ...await exec(process.execPath, [fileURLToPath(new URL('../recovery-smoke.js', import.meta.url)), root, mode, ...(invalid ? [invalid] : [])],
      { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }), code: 0 }
  } catch (error) {
    if (typeof error.code !== 'number') throw error
    return error
  }
}
const recovered = result => {
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split('\n').find(line => line.startsWith('RECOVERED '))
  assert.ok(line, result.stdout)
  return JSON.parse(line.slice('RECOVERED '.length))
}

test('worker deployment and read errors reject promptly without poisoning later work', { timeout: 20000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-worker-error-'))
  try {
    const result = await run(root, 'prepare', 'deployment')
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('real worker and signed blocks recover exactly once across process crashes at every checkpoint boundary', { timeout: 60000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-'))
  try {
    const seed = join(root, 'seed')
    const baselineRoot = join(root, 'baseline')
    const prepared = await run(seed, 'prepare')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    await cp(seed, baselineRoot, { recursive: true })
    const baseline = recovered(await run(baselineRoot, 'recover'))
    assert.deepEqual(baseline.recipient, { $bigint: '200' }, 'both stored transactions must actually transfer tokens')
    assert.deepEqual(baseline.info.nativeTransfers, { $bigint: '2' })
    assert.deepEqual(baseline.info.totalTransferAmount, { $bigint: '200' })
    assert.deepEqual(baseline.info.totalBlocks, { $bigint: '2' })
    assert.ok(Object.values(baseline.accounts).every(nonce => nonce === '2'))
    assert.deepEqual(baseline.custom, ['7', '11'].map(value => ({ state: { value: { $bigint: value } }, value: { $bigint: value } })),
      'unchanged custom contracts must remain in every full checkpoint')
    assert.deepEqual(recovered(await run(baselineRoot, 'recover')), baseline, 'a clean restart must not repeat fees or rewards')
    for (const mode of ['crash-before-checkpoint', 'crash-torn', 'crash-after-checkpoint', 'crash-after-marker']) {
      const scenario = join(root, mode)
      await cp(seed, scenario, { recursive: true })
      const crashed = await run(scenario, mode)
      assert.equal(crashed.code, 71, `${mode}\n${crashed.stdout}\n${crashed.stderr}`)
      assert.deepEqual(recovered(await run(scenario, 'recover')), baseline, mode)
      assert.deepEqual(recovered(await run(scenario, 'recover')), baseline, `${mode}: second restart`)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('invalid proof or failed execution rejects readiness and never becomes a recovered tip', { timeout: 60000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-reject-'))
  try {
    for (const invalid of ['proof', 'execution', 'missing', 'tampered', 'no-anchor', 'contract', 'nested-static']) {
      const scenario = join(root, invalid)
      const prepared = await run(scenario, 'prepare', invalid)
      assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await run(scenario, 'recover')
        assert.equal(result.code, 42, `${invalid}\n${result.stdout}\n${result.stderr}`)
        assert.match(result.stderr, /RECOVERY_REJECTED/)
        assert.doesNotMatch(result.stdout, /RECOVERED |\[chain\] init:done/)
      }
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('public and nested static calls cannot mutate canonical contracts, counters or checkpoints', { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-read-isolation-'))
  try {
    const prepared = await run(root, 'prepare')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    const result = await run(root, 'queries')
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /READ_ISOLATION_OK/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a split legacy snapshot is rebuilt from genesis without preserving ahead-of-tip nonces or invented counters', { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-legacy-'))
  try {
    const prepared = await run(root, 'prepare', 'legacy-empty')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    const result = recovered(await run(root, 'recover'))
    assert.deepEqual(result.tip.index, -1)
    assert.equal(result.tip.hash, '0x0')
    assert.deepEqual(result.accounts, {})
    assert.deepEqual(result.info.totalTransactions, { $bigint: '0' })
    assert.deepEqual(result.info.totalBlocks, { $bigint: '0' })
    assert.deepEqual(recovered(await run(root, 'recover')), result)
  } finally { await rm(root, { recursive: true, force: true }) }
})

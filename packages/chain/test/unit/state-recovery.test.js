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

test('recovery connects before readiness, fetches a late transaction provider and preserves canonical validation', { timeout: 60000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-early-transport-'))
  try {
    const seed = join(root, 'seed'), baselineRoot = join(root, 'baseline'), recoveredRoot = join(root, 'peer-body'), rejectedRoot = join(root, 'peer-corrupt')
    const prepared = await run(seed, 'prepare')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    for (const target of [baselineRoot, recoveredRoot, rejectedRoot]) await cp(seed, target, { recursive: true })
    const baseline = recovered(await run(baselineRoot, 'recover'))
    const result = await run(recoveredRoot, 'recover-peer-body')
    assert.match(result.stdout, /RECOVERY_EARLY_TRANSPORT_OK/)
    assert.deepEqual(recovered(result), baseline, 'fetched transactions must execute exactly like local canonical bodies')
    assert.deepEqual(recovered(await run(recoveredRoot, 'recover')), baseline, 'restart must not repeat fees or transfers')
    const corrupt = await run(rejectedRoot, 'recover-peer-corrupt')
    assert.equal(corrupt.code, 42, `${corrupt.stdout}\n${corrupt.stderr}`)
    assert.match(corrupt.stderr, /RECOVERY_REJECTED/)
    assert.doesNotMatch(corrupt.stdout, /RECOVERED |\[chain\] init:done/)
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

test('a conflicting speculative target cannot override a committed checkpoint', { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-target-conflict-'))
  try {
    const prepared = await run(root, 'prepare')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    const baseline = recovered(await run(root, 'recover'))
    const installed = await run(root, 'set-target-conflict')
    assert.equal(installed.code, 0, `${installed.stdout}\n${installed.stderr}`)
    const restart = await run(root, 'recover')
    assert.match(restart.stderr, /ignoring conflicting recoveryTarget/)
    const result = recovered(restart)
    assert.deepEqual(result, baseline)
    assert.deepEqual(result.info.totalBlocks, { $bigint: '2' })
    assert.deepEqual(result.info.nativeTransfers, { $bigint: '2' })
    assert.deepEqual(recovered(await run(root, 'recover')), result, 'startup should stay idempotent after dropping stale marker')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('conflicting uncheckpointed histories remain explicit and preserve the recovery target', { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-uncommitted-conflict-'))
  try {
    const prepared = await run(root, 'prepare', 'recovery-target-conflict')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await run(root, 'recover', 'preserve-target')
      assert.equal(result.code, 42, `${result.stdout}\n${result.stderr}`)
      assert.match(result.stderr, /conflicts with uncheckpointed canonical history/)
      assert.doesNotMatch(result.stdout, /RECOVERED |\[chain\] init:done/)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('missing recovery bodies and I/O failures stop startup without discarding recovery state', { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-recovery-target-unavailable-'))
  try {
    const prepared = await run(root, 'prepare')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    recovered(await run(root, 'recover'))
    const installed = await run(root, 'set-target-missing')
    assert.equal(installed.code, 0, `${installed.stdout}\n${installed.stderr}`)
    for (const mode of ['recover', 'recover-target-read-error', 'recover']) {
      const result = await run(root, mode, 'preserve-target')
      assert.equal(result.code, 42, `${result.stdout}\n${result.stderr}`)
      assert.match(result.stderr, /Recovery block unavailable|fixture recovery target read failure/)
      assert.doesNotMatch(result.stdout, /RECOVERED |\[chain\] init:done/)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('real signed catch-up rejects a taller peer fork without poisoning recovery and accepts the valid continuation', { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-sync-fork-'))
  try {
    const prepared = await run(root, 'prepare')
    assert.equal(prepared.code, 0, `${prepared.stdout}\n${prepared.stderr}`)
    const synced = await run(root, 'sync-fork')
    const result = recovered(synced)
    assert.match(synced.stdout, /SYNC_FORK_REJECTED_WITHOUT_POISONING_RECOVERY/)
    assert.deepEqual(result.info.totalBlocks, { $bigint: '2' })
    assert.deepEqual(result.recipient, { $bigint: '200' })
    assert.deepEqual(recovered(await run(root, 'recover')), result)
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

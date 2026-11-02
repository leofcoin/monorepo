import test from 'node:test'
import assert from 'node:assert/strict'
import { cpuMilliseconds, descendants } from './chain-metrics.js'
import { validateAudit, auditEvidence, summarize } from './chain-audit.js'

test('CPU time parsing preserves sub-second macOS and Linux/day formats', () => {
  assert.equal(cpuMilliseconds('0:00.13'), 130)
  assert.equal(cpuMilliseconds('01:02:03'), 3723000)
  assert.equal(cpuMilliseconds('2-01:00:00'), 176400000)
  assert.throws(() => cpuMilliseconds('invalid'))
})
test('resource selection includes descendants but never unrelated processes', () => {
  const rows = [{ pid: 3, parent: 2 }, { pid: 2, parent: 1 }, { pid: 1, parent: 999 }, { pid: 4, parent: 999 }]
  assert.deepEqual(descendants(rows, [1]).map(row => row.pid), [3, 2, 1])
})

const hashes = ['a', 'b']
const audit = { nonce: 2n, recipientBalance: 200n, totalTransactions: 3n, nativeTransfers: 2n,
  supply: 1000n, balanceSum: 1000n, transactions: hashes, tip: { index: 1, hash: 'block' } }
test('block membership and nonce alone cannot pass without actual balance effects', () => {
  assert.doesNotThrow(() => validateAudit(audit, hashes, 200n))
  assert.throws(() => validateAudit({ ...audit, recipientBalance: 0n }, hashes, 200n), /Transfer effects/)
  assert.throws(() => validateAudit({ ...audit, nonce: 1n }, hashes, 200n), /nonce/)
  assert.throws(() => validateAudit({ ...audit, transactions: ['a', 'a'] }, hashes, 200n), /membership/)
  assert.throws(() => validateAudit({ ...audit, balanceSum: 1001n }, hashes, 200n), /Supply conservation/)
  assert.doesNotThrow(() => JSON.stringify(auditEvidence(audit)))
})
test('invalid samples never contribute performance numbers to the summary', () => {
  const phases = { confirmation: { durationMs: 200 }, coldSync: { durationMs: 100 } }
  const result = summarize([{ label: 'baseline', status: 'failed', phases },
    { label: 'current', status: 'passed', phases },
    { label: 'current', status: 'passed', phases: { confirmation: { durationMs: 400 }, coldSync: { durationMs: 300 } } }])
  assert.deepEqual(result.baseline, { passedSamples: 0 })
  assert.equal(result.current.confirmation.durationMs, 300)
  assert.equal(result.current.coldSync.durationMs, 200)
})

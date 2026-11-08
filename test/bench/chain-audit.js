import assert from 'node:assert/strict'

export function validateAudit(audit, hashes, amount) {
  assert.equal(audit.nonce, BigInt(hashes.length), 'Committed account nonce mismatch')
  assert.equal(audit.recipientBalance, amount, 'Transfer effects missing or replayed')
  // Canonical execution also records exactly one validator snapshot per block.
  const measuredBlocks = audit.measuredBlocks ?? 1
  assert.ok(Number.isSafeInteger(measuredBlocks) && measuredBlocks > 0, 'Invalid measured block count')
  assert.equal(audit.totalTransactions, BigInt(hashes.length + measuredBlocks), 'Execution counter mismatch')
  assert.equal(audit.nativeTransfers, BigInt(hashes.length), 'Native transfer counter mismatch')
  assert.equal(audit.balanceSum, audit.supply, 'Supply conservation failed')
  assert.deepEqual([...audit.transactions].sort(), [...hashes].sort(), 'Canonical transaction membership mismatch')
}

export function auditEvidence(audit) {
  return { tip: audit.tip, nonce: String(audit.nonce), recipientBalance: String(audit.recipientBalance),
    totalExecutions: String(audit.totalTransactions), userTransfers: String(audit.nativeTransfers),
    supply: String(audit.supply), balanceSum: String(audit.balanceSum), measuredBlocks: audit.measuredBlocks ?? 1,
    transactions: audit.transactions }
}

export function summarize(results) {
  const median = values => {
    const ordered = values.toSorted((a, b) => a - b), middle = Math.floor(ordered.length / 2)
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
  }
  const summary = {}
  for (const label of [...new Set(results.map(result => result.label))]) {
    const passed = results.filter(result => result.label === label && result.status === 'passed')
    summary[label] = { passedSamples: passed.length }
    if (!passed.length) continue
    for (const phase of ['confirmation', 'coldSync']) {
      summary[label][phase] = Object.fromEntries(['durationMs', 'transactionsPerSecond', 'sampledCpuMs', 'peakAggregateRssBytes']
        .filter(key => passed.every(result => Number.isFinite(result.phases[phase][key])))
        .map(key => [key, median(passed.map(result => result.phases[phase][key]))]))
    }
  }
  return summary
}

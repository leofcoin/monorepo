import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import test from 'node:test'
import { parseUnits } from '@leofcoin/utils'

const run = seed => JSON.parse(execFileSync(process.execPath,
  ['scripts/simulate-testnet-market.js', '--json', '--seed', String(seed)], { encoding: 'utf8' }))

test('seeded market uses finite inventories, actual pool swaps and simulated service payments', () => {
  const result = run(42)
  assert.match(result.scope, /isolated in-memory/)
  assert.deepEqual(run(42), result)
  assert.equal(result.snapshots.length, 31)
  assert.equal(result.snapshots[0].spotTEurPerLfc, '0.100000')
  assert.ok(result.metrics.buys > 0 && result.metrics.sells > 0)
  assert.ok(result.metrics.servicePayments > 0)
  assert.equal(BigInt(parseUnits(result.metrics.serviceLfc)), BigInt(result.metrics.servicePayments) * 2n * 10n ** 18n)
  for (const token of ['LFC', 'tEUR']) {
    const pool = token === 'LFC' ? result.snapshots.at(-1).poolLfc : result.snapshots.at(-1).poolTEur
    const total = Object.values(result.balances).reduce((sum, balance) => sum + BigInt(parseUnits(balance[token])), BigInt(parseUnits(pool)))
    assert.equal(total, BigInt(token === 'LFC' ? 1424 : 300) * 10n ** 18n)
  }
  assert.notDeepEqual(run(7).snapshots, result.snapshots)
})

test('rejects invalid simulation inputs', () => {
  const result = spawnSync(process.execPath, ['scripts/simulate-testnet-market.js', '--rounds', '0'], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Usage/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restoreBalances, restoreApprovals } from './../exports/helpers.js'

test('Helpers - restoreBalances converts string balances to BigInt', () => {
  const balances = {
    '0x1': '1000',
    '0x2': '2000',
    '0x3': '5000'
  }

  const restored = restoreBalances(balances)

  assert.equal(restored['0x1'], 1000n)
  assert.equal(restored['0x2'], 2000n)
  assert.equal(restored['0x3'], 5000n)
})

test('Helpers - restoreBalances handles empty balances', () => {
  const balances = {}

  const restored = restoreBalances(balances)

  assert.deepEqual(restored, {})
})

test('Helpers - restoreApprovals converts nested string approvals to BigInt', () => {
  const approvals = {
    '0x1': {
      '0x2': '500',
      '0x3': '1000'
    },
    '0x2': {
      '0x3': '250'
    }
  }

  const restored = restoreApprovals(approvals)

  assert.equal(restored['0x1']['0x2'], 500n)
  assert.equal(restored['0x1']['0x3'], 1000n)
  assert.equal(restored['0x2']['0x3'], 250n)
})

test('Helpers - restoreApprovals handles empty approvals', () => {
  const approvals = {}

  const restored = restoreApprovals(approvals)

  assert.deepEqual(restored, {})
})

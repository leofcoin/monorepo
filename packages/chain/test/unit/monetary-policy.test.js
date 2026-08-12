import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BLOCKS_PER_YEAR,
  calculateMonetaryPolicy,
  distributeAmount,
  supportsMonetaryPolicy
} from '@leofcoin/lib'

const target = 100_000_000n * 10n ** 18n

test('mints at no more than two percent annually below the supply floor', () => {
  const policy = calculateMonetaryPolicy(0n, target)
  assert.equal(policy.subsidy * BLOCKS_PER_YEAR, (target * 200n) / 10_000n - ((target * 200n) / 10_000n) % BLOCKS_PER_YEAR)
  assert.equal(policy.burnBasisPoints, 0n)
})

test('does not overshoot the supply floor', () => {
  const floor = (target * 9_500n) / 10_000n
  assert.deepEqual(calculateMonetaryPolicy(floor - 1n, target), {
    subsidy: 1n,
    burnBasisPoints: 0n,
    floorSupply: floor
  })
})

test('uses a neutral band and only burns fees at or above target', () => {
  assert.equal(calculateMonetaryPolicy((target * 9_750n) / 10_000n, target).subsidy, 0n)
  assert.equal(calculateMonetaryPolicy((target * 9_750n) / 10_000n, target).burnBasisPoints, 0n)
  assert.equal(calculateMonetaryPolicy(target, target).burnBasisPoints, 1_000n)
})

test('distributes every subsidy atom deterministically', () => {
  const rewards = distributeAmount(10n, ['c', 'a', 'b'], 1)
  assert.equal([...rewards.values()].reduce((sum, amount) => sum + amount, 0n), 10n)
  assert.deepEqual(rewards, distributeAmount(10n, ['b', 'c', 'a'], 1))
})

test('activates adaptive policy at protocol 1.10.10', () => {
  assert.equal(supportsMonetaryPolicy('1.10.9'), false)
  assert.equal(supportsMonetaryPolicy('1.10.10'), true)
})

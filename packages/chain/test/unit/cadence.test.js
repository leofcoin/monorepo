import assert from 'node:assert/strict'
import test from 'node:test'

import { benchmarkBlockTime, nextBlockIndex, proposalDelay } from '../../src/consensus/cadence.ts'

test('one-second proposal timing is available only when both configured and actual networks are isolated', () => {
  const config = { network: 'leofcoin:e2e', benchmarkBlockTimeMs: 1000 }
  assert.equal(proposalDelay({ now: 10_001, lastBlockTimestamp: 10_000,
    blockTime: benchmarkBlockTime(config, 'leofcoin:e2e') }), 999)
  assert.throws(() => benchmarkBlockTime(config, 'leofcoin:peach'), /isolated/)
  assert.throws(() => benchmarkBlockTime({ ...config, network: 'leofcoin:peach' }, 'leofcoin:e2e'), /isolated/)
  assert.equal(benchmarkBlockTime({ network: 'leofcoin:peach' }, 'leofcoin:peach'), 6000)
})

test('invalid benchmark intervals fail instead of silently changing proposal cadence', () => {
  for (const benchmarkBlockTimeMs of [0, -1, 2000, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => benchmarkBlockTime({ network: 'leofcoin:e2e', benchmarkBlockTimeMs }, 'leofcoin:e2e'),
      /1000 or 6000/)
})

test('derives the same numeric next height from number and bigint indexes', () => {
  assert.equal(nextBlockIndex(undefined), 0)
  assert.equal(nextBlockIndex(41), 42)
  assert.equal(nextBlockIndex(41n), 42)
})

test('paces proposals from the last canonical block during transaction backlog', () => {
  assert.equal(
    proposalDelay({ now: 10_001, lastBlockTimestamp: 10_000, lastProposalAt: 0, blockTime: 6_000 }),
    5_999
  )
})

test('paces repeated attempts even when no new block was committed', () => {
  assert.equal(
    proposalDelay({ now: 15_000, lastBlockTimestamp: 1_000, lastProposalAt: 12_000, blockTime: 6_000 }),
    3_000
  )
})

test('allows a proposal once both canonical and local cadence have elapsed', () => {
  assert.equal(
    proposalDelay({ now: 20_000, lastBlockTimestamp: 10_000, lastProposalAt: 12_000, blockTime: 6_000 }),
    0
  )
})

test('does not let a future canonical timestamp stall production indefinitely', () => {
  assert.equal(
    proposalDelay({ now: 20_000, lastBlockTimestamp: 200_000, lastProposalAt: 0, blockTime: 6_000 }),
    6_000
  )
})

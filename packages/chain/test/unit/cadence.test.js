import assert from 'node:assert/strict'
import test from 'node:test'

import { nextBlockIndex, proposalDelay } from '../../src/consensus/cadence.ts'

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

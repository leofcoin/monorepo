import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { methods } from '../helpers/canonical-state-harness.js'

import { DEFAULT_BLOCK_TIME_MS, nextBlockIndex, proposalDelay } from '../../src/consensus/cadence.ts'

test('epoch transition resets the round after sixty blocks rather than ten', async () => {
  const production = methods('../../src/chain.ts', 'Chain', ['#epochLength', '#isEpochBoundary', '#handleBlockCommit'])
  const { outputText } = ts.transpileModule(`class Epoch {
    ${production}
    #currentEpochStartHeight = 0
    #consensusRound = 5
    #participating = false
    #runningEpoch = false
    async #runEpoch() {}
    handle(height) { return this.#handleBlockCommit(height) }
    get state() { return [this.#currentEpochStartHeight, this.#consensusRound] }
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  const Epoch = new Function('debug', `${outputText}; return Epoch`)(() => {})
  const epoch = new Epoch()
  await epoch.handle(9)
  await epoch.handle(58)
  assert.deepEqual(epoch.state, [0, 5])
  await epoch.handle(59)
  assert.deepEqual(epoch.state, [60, 0])
  await epoch.handle(119)
  assert.deepEqual(epoch.state, [120, 0])
})

test('ordinary durable commits wake the next proposer without waiting for new transactions', async () => {
  const production = methods('../../src/chain.ts', 'Chain', ['#epochLength', '#isEpochBoundary', '#handleBlockCommit'])
  const { outputText } = ts.transpileModule(`class Commit {
    ${production}
    #currentEpochStartHeight = 0
    #consensusRound = 0
    #participating
    #runningEpoch
    pendingTransactions
    runs = 0
    constructor(participating, running, pending) {
      this.#participating = participating
      this.#runningEpoch = running
      this.pendingTransactions = { size: pending }
    }
    async #runEpoch() { this.runs++ }
    handle() { return this.#handleBlockCommit(1) }
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  const Commit = new Function('debug', `${outputText}; return Commit`)(() => {})
  for (const [participating, running, pending, expected] of [
    [true, false, 512, 1], [false, false, 512, 0], [true, true, 512, 0], [true, false, 0, 0]
  ]) {
    const commit = new Commit(participating, running, pending)
    await commit.handle()
    assert.equal(commit.runs, expected)
  }
})

test('derives the same numeric next height from number and bigint indexes', () => {
  assert.equal(nextBlockIndex(undefined), 0)
  assert.equal(nextBlockIndex(41), 42)
  assert.equal(nextBlockIndex(41n), 42)
})

test('paces proposals from the last canonical block during transaction backlog', () => {
  assert.equal(
    proposalDelay({ now: 10_001, lastBlockTimestamp: 10_000, lastProposalAt: 0, blockTime: DEFAULT_BLOCK_TIME_MS }),
    999
  )
})

test('paces repeated attempts even when no new block was committed', () => {
  assert.equal(
    proposalDelay({ now: 12_500, lastBlockTimestamp: 1_000, lastProposalAt: 12_000, blockTime: DEFAULT_BLOCK_TIME_MS }),
    500
  )
})

test('allows a proposal once both canonical and local cadence have elapsed', () => {
  assert.equal(
    proposalDelay({ now: 20_000, lastBlockTimestamp: 10_000, lastProposalAt: 12_000, blockTime: DEFAULT_BLOCK_TIME_MS }),
    0
  )
})

test('does not let a future canonical timestamp stall production indefinitely', () => {
  assert.equal(
    proposalDelay({ now: 20_000, lastBlockTimestamp: 200_000, lastProposalAt: 0, blockTime: DEFAULT_BLOCK_TIME_MS }),
    1_000
  )
})

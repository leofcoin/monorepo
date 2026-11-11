import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { methods } from '../helpers/canonical-state-harness.js'
import { nextBlockIndex, proposalDelay } from '../../src/consensus/cadence.ts'

const timer = methods('../../src/chain.ts', 'Chain', ['#armRoundTimer'])
function fixture() {
  const source = `class Round {
    #roundTimer = null
    #slotTime = 10000
    #consensusRound = 0
    #proposalInFlight = { index: 1, hash: 'pending' }
    #runningEpoch = true
    #participating = true
    lastBlock = Promise.resolve({ index: 0n })
    runs = 0
    async #runEpoch() { this.runs++ }
    arm() { this.#armRoundTimer(1, 0) }
    get state() { return { round: this.#consensusRound, proposal: this.#proposalInFlight } }
    ${timer}
  }`
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const Round = new Function('nextBlockIndex', 'debug', `${js};return Round`)(nextBlockIndex, () => {})
  return new Round()
}

test('missing precommits advance a participating validator to the next round', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const round = fixture()
  round.arm(); round.arm() // Re-arming must not create duplicate timeouts.
  t.mock.timers.tick(10000)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(round.state, { round: 1, proposal: null })
  assert.equal(round.runs, 1)
})

test('an old height timeout cannot advance the round after a canonical commit', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const round = fixture()
  round.arm(); round.lastBlock = Promise.resolve({ index: 1n })
  t.mock.timers.tick(10000)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(round.state.round, 0)
  assert.equal(round.runs, 0)
})

const activationMethods = methods('../../src/chain.ts', 'Chain', ['#runEpoch', 'participate'])
function activationFixture(stage) {
  const failure = new DOMException('File snapshot is unreadable', 'NotReadableError')
  const boundary = { stage, failure }
  const source = `class Activation {
    #runningEpoch = false
    #participating = false
    #proposalInFlight = null
    #lastProposalAt = 0
    #blockTime = 0
    #consensusRound = 0
    #roundTimer = null
    proposals = 0
    lastBlock = Promise.resolve({ index: -1n })
    get state() { return { running: this.#runningEpoch, participating: this.#participating } }
    fail(stage) {
      if (boundary.stage === stage && boundary.failure) {
        const error = boundary.failure
        boundary.failure = undefined
        throw error
      }
    }
    async staticCall() { return true }
    async hasTransactionToHandle() {
      if (this.proposals) this.fail('pool')
      return true
    }
    async #getConsensusValidators() { this.fail('validators'); return ['validator'] }
    #isJailed() { return false }
    async #sleep() {}
    #armRoundTimer() {}
    async #createBlock() {
      this.proposals++
      this.fail('proposal')
      this.#proposalInFlight = { index: 0 }
    }
    ${activationMethods}
  }`
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const Activation = new Function('boundary', 'peernet', 'addresses', 'nextBlockIndex', 'proposalDelay',
    `${js};return Activation`)(boundary, { selectedAccount: 'validator' }, { validators: 'registry' },
    nextBlockIndex, proposalDelay)
  return { chain: new Activation(), failure }
}

test('participation surfaces storage failures without an automatic retry or a stuck epoch flag', async () => {
  for (const stage of ['validators', 'proposal', 'pool']) {
    const { chain, failure } = activationFixture(stage)
    await assert.rejects(chain.participate('validator'), error => {
      assert.match(error.message, /validator participation failed: File snapshot is unreadable/)
      assert.equal(error.cause, failure)
      return true
    })
    assert.deepEqual(chain.state, { running: false, participating: false })
    assert.equal(chain.proposals, stage === 'validators' ? 0 : 1)
    assert.equal(await chain.participate('validator'), true)
    assert.deepEqual(chain.state, { running: false, participating: true })
  }
})

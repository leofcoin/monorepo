import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { methods } from '../helpers/canonical-state-harness.js'
import { nextBlockIndex } from '../../src/consensus/cadence.ts'

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

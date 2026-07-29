import assert from 'node:assert/strict'
import test from 'node:test'

import { quorumThreshold } from '../src/consensus/quorum.ts'

test('quorum requires strictly more than two thirds of validators', () => {
  assert.equal(quorumThreshold(1), 1)
  assert.equal(quorumThreshold(2), 2)
  assert.equal(quorumThreshold(3), 3)
  assert.equal(quorumThreshold(4), 3)
  assert.equal(quorumThreshold(6), 5)
  assert.equal(quorumThreshold(7), 5)
})

test('quorum rejects invalid validator counts', () => {
  assert.throws(() => quorumThreshold(0), /positive safe integer/)
  assert.throws(() => quorumThreshold(-1), /positive safe integer/)
  assert.throws(() => quorumThreshold(1.5), /positive safe integer/)
})

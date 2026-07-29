import assert from 'node:assert/strict'
import test from 'node:test'

import { validateChainLink } from '../../src/consensus/chain-link.ts'

test('accepts genesis and the next block using only the persisted tip', () => {
  assert.equal(
    validateChainLink({ index: -1, hash: '0x0' }, { index: 0, hash: 'genesis', previousHash: '0x0' }),
    'append'
  )
  assert.equal(
    validateChainLink({ index: 41, hash: 'tip' }, { index: 42, hash: 'next', previousHash: 'tip' }),
    'append'
  )
})

test('classifies duplicates and stale gossip without requiring an in-memory block cache', () => {
  assert.equal(
    validateChainLink({ index: 42, hash: 'tip' }, { index: 42, hash: 'tip', previousHash: 'parent' }),
    'duplicate'
  )
  assert.equal(
    validateChainLink({ index: 42, hash: 'tip' }, { index: 40, hash: 'old', previousHash: 'older' }),
    'stale'
  )
})

test('rejects gaps, forks at the tip, and parent mismatches', () => {
  assert.throws(
    () => validateChainLink({ index: 42, hash: 'tip' }, { index: 44, hash: 'gap', previousHash: 'tip' }),
    /Unexpected block index/
  )
  assert.throws(
    () => validateChainLink({ index: 42, hash: 'tip' }, { index: 42, hash: 'fork', previousHash: 'parent' }),
    /Block conflict/
  )
  assert.throws(
    () => validateChainLink({ index: 42, hash: 'tip' }, { index: 43, hash: 'next', previousHash: 'wrong' }),
    /previousHash mismatch/
  )
})

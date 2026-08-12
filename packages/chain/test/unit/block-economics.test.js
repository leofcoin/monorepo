import assert from 'node:assert/strict'
import test from 'node:test'

import { validateBlockEconomics, validateCanonicalValidatorSet } from '../../src/consensus/block-economics.ts'

const validators = [
  { address: 'a', reward: 51n },
  { address: 'b', reward: 51n },
  { address: 'c', reward: 51n }
]

test('accepts the canonical validator set and recomputed block economics', () => {
  validateCanonicalValidatorSet(7n, ['c', 'a', 'b'], validators)
  validateBlockEconomics(
    { index: 7n, reward: 150n, fees: 3n, validators },
    3n,
    new Map([
      ['a', 1n],
      ['b', 1n],
      ['c', 1n]
    ]),
    new Map([
      ['a', 50n],
      ['b', 50n],
      ['c', 50n]
    ])
  )
})

test('rejects validator omission, replacement, and unexpected additions', () => {
  assert.throws(() => validateCanonicalValidatorSet(7n, ['a', 'b', 'c'], validators.slice(0, 2)), /set mismatch/)
  assert.throws(
    () => validateCanonicalValidatorSet(7n, ['a', 'b', 'c'], [...validators.slice(0, 2), { address: 'd', reward: 51n }]),
    /set mismatch/
  )
  assert.throws(
    () => validateCanonicalValidatorSet(7n, ['a', 'b', 'c'], [...validators, { address: 'd', reward: 51n }]),
    /set mismatch/
  )
})

test('rejects proposer-controlled reward, fee, and distribution inflation', () => {
  assert.throws(
    () => validateBlockEconomics({ index: 7n, reward: 150n, fees: 3n, validators: [] }, 3n),
    /without validators/
  )
  assert.throws(
    () => validateBlockEconomics({ index: 7n, reward: 10_000n, fees: 3n, validators }, 3n, new Map(), new Map([['a', 150n]])),
    /invalid base reward/
  )
  assert.throws(
    () => validateBlockEconomics({ index: 7n, reward: 150n, fees: 10_000n, validators }, 3n, new Map(), new Map([['a', 150n]])),
    /invalid fees/
  )
  assert.throws(
    () =>
      validateBlockEconomics(
        {
          index: 7n,
          reward: 150n,
          fees: 3n,
          validators: validators.map((validator) => ({ ...validator, reward: 10_000n }))
        },
        3n,
        new Map(),
        new Map([['a', 150n]])
      ),
    /invalid reward/
  )
})

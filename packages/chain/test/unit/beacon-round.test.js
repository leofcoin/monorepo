import assert from 'node:assert/strict'
import test from 'node:test'

import { toBase58 } from '@vandeurenglenn/typed-array-utils'

import {
  createBeaconContribution,
  combineBeaconShares,
  beaconMessage,
  signBeaconRound
} from '../../src/consensus/beacon.ts'
import { BeaconRound } from '../../src/consensus/beacon-round.ts'

const validators = ['validator-a', 'validator-b', 'validator-c', 'validator-d']
const participants = [1n, 2n, 3n, 4n]
let scalar = 2n
const dealers = validators.map((validator) => {
  const contribution = createBeaconContribution(participants, 3, () => scalar++)
  return { validator, contribution }
})
const config = {
  epoch: 1n,
  threshold: 3,
  validators,
  dealers: dealers.map(({ validator, contribution }) => ({
    validator,
    commitments: contribution.commitments.map((commitment) => toBase58(commitment))
  }))
}
const secretShares = new Map(
  validators.map((validator, index) => [
    validator,
    combineBeaconShares(dealers.map(({ contribution }) => contribution.shares.get(BigInt(index + 1))))
  ])
)

const share = (validator, round = 4n) => ({
  from: validator,
  participant: BigInt(validators.indexOf(validator) + 1),
  signature: toBase58(
    signBeaconRound(secretShares.get(validator), beaconMessage('leofcoin', 1n, round, new Uint8Array(96)))
  )
})

test('finalizes the same proof for different valid arrival orders', () => {
  const first = new BeaconRound('leofcoin', config, 4n, new Uint8Array(96))
  const second = new BeaconRound('leofcoin', config, 4n, new Uint8Array(96))
  for (const validator of ['validator-a', 'validator-b', 'validator-c'])
    assert.equal(first.add(share(validator)), 'accepted')
  for (const validator of ['validator-d', 'validator-c', 'validator-b'])
    assert.equal(second.add(share(validator)), 'accepted')
  assert.equal(first.finalize().proof, second.finalize().proof)
  assert.equal(first.finalize().randomness, second.finalize().randomness)
})

test('rejects wrong participants, rounds and altered shares', () => {
  const round = new BeaconRound('leofcoin', config, 4n, new Uint8Array(96))
  assert.equal(round.add({ ...share('validator-a'), participant: 2n }), 'invalid')
  assert.equal(round.add(share('validator-a', 5n)), 'invalid')
  const altered = share('validator-a')
  altered.signature = altered.signature.slice(0, -1) + (altered.signature.endsWith('1') ? '2' : '1')
  assert.equal(round.add(altered), 'invalid')
  assert.throws(() => round.finalize(), /threshold/)
})

test('detects a validator sending two different shares for one round', () => {
  const round = new BeaconRound('leofcoin', config, 4n, new Uint8Array(96))
  const valid = share('validator-a')
  assert.equal(round.add(valid), 'accepted')
  assert.equal(round.add({ ...valid, signature: share('validator-b').signature }), 'equivocation')
  assert.equal(round.equivocation('validator-a').length, 2)
})

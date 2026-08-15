import assert from 'node:assert/strict'
import test from 'node:test'

import { bls12_381 as bls } from '@noble/curves/bls12-381'
import { toBase58 } from '@vandeurenglenn/typed-array-utils'

import {
  beaconEpochDigest,
  beaconEpochGroupPublicKey,
  beaconParticipants,
  BeaconEpochVotes,
  canonicalBeaconEpochConfig,
  validateBeaconEpochConfig
} from '../../src/consensus/beacon-epoch.ts'

const validators = ['validator-c', 'validator-a', 'validator-b', 'validator-d']
const commitment = (value) => toBase58(bls.getPublicKey(BigInt(value)))
const config = {
  epoch: 2n,
  threshold: 3,
  validators,
  dealers: [
    { validator: 'validator-c', commitments: [commitment(2), commitment(3), commitment(5)] },
    { validator: 'validator-a', commitments: [commitment(7), commitment(11), commitment(13)] },
    { validator: 'validator-b', commitments: [commitment(17), commitment(19), commitment(23)] },
    { validator: 'validator-d', commitments: [commitment(29), commitment(31), commitment(37)] }
  ]
}

test('maps sorted validators to stable non-zero participant identifiers', () => {
  assert.deepEqual(
    [...beaconParticipants(validators)],
    [
      ['validator-a', 1n],
      ['validator-b', 2n],
      ['validator-c', 3n],
      ['validator-d', 4n]
    ]
  )
})

test('canonical config digest and group key ignore arrival order', () => {
  const reordered = { ...config, validators: [...validators].reverse(), dealers: [...config.dealers].reverse() }
  assert.equal(validateBeaconEpochConfig(config), true)
  assert.deepEqual(canonicalBeaconEpochConfig(config), canonicalBeaconEpochConfig(reordered))
  assert.equal(beaconEpochDigest(config), beaconEpochDigest(reordered))
  assert.equal(beaconEpochGroupPublicKey(config), beaconEpochGroupPublicKey(reordered))
})

test('rejects missing, duplicate, foreign, and wrong-threshold dealers', () => {
  assert.equal(validateBeaconEpochConfig({ ...config, threshold: 2 }), false)
  assert.equal(validateBeaconEpochConfig({ ...config, dealers: config.dealers.slice(0, 2) }), false)
  assert.equal(
    validateBeaconEpochConfig({
      ...config,
      dealers: [config.dealers[0], config.dealers[0], ...config.dealers.slice(2)]
    }),
    false
  )
  assert.equal(
    validateBeaconEpochConfig({
      ...config,
      dealers: [{ ...config.dealers[0], validator: 'foreign' }, ...config.dealers.slice(1)]
    }),
    false
  )
})

test('activates only with quorum and detects equivocation', () => {
  const votes = new BeaconEpochVotes(config)
  const digest = votes.configDigest
  assert.equal(votes.add({ epoch: 2n, configDigest: digest, from: 'validator-a', signature: 'a' }), 'accepted')
  assert.equal(votes.add({ epoch: 2n, configDigest: digest, from: 'validator-a', signature: 'a' }), 'duplicate')
  assert.equal(votes.add({ epoch: 2n, configDigest: digest, from: 'validator-b', signature: 'b' }), 'accepted')
  assert.equal(votes.ready, false)
  assert.equal(votes.add({ epoch: 2n, configDigest: digest, from: 'validator-c', signature: 'c' }), 'accepted')
  assert.equal(votes.ready, true)
  assert.deepEqual(
    votes.certificate().map(({ from }) => from),
    ['validator-a', 'validator-b', 'validator-c']
  )
  assert.equal(votes.add({ epoch: 2n, configDigest: 'other', from: 'validator-a', signature: 'evil' }), 'equivocation')
  assert.equal(votes.equivocation('validator-a').length, 2)
})

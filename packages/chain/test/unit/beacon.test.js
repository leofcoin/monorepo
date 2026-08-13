import assert from 'node:assert/strict'
import test from 'node:test'

import {
  beaconMessage,
  beaconRandomness,
  combineBeaconShares,
  createBeaconContribution,
  deriveBeaconGroupPublicKey,
  deriveBeaconPublicShare,
  reconstructBeaconSignature,
  signBeaconRound,
  verifyBeaconProof,
  verifyBeaconShare,
  verifyBeaconSignatureShare
} from '../../src/consensus/beacon.ts'

const participants = [1n, 2n, 3n, 4n]
const threshold = 3
const scalars = [11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n]
let scalarIndex = 0
const randomScalar = () => scalars[scalarIndex++]

const ceremony = () => {
  scalarIndex = 0
  const dealers = participants.map(() => createBeaconContribution(participants, threshold, randomScalar))
  const commitments = dealers.map((dealer) => dealer.commitments)
  const secretShares = new Map(
    participants.map((participant) => [
      participant,
      combineBeaconShares(dealers.map((dealer) => dealer.shares.get(participant)))
    ])
  )
  return { commitments, secretShares }
}

test('verifies DKG shares and rejects altered private shares', () => {
  const dealer = createBeaconContribution(participants, threshold, () => randomScalar())
  for (const participant of participants) {
    const share = dealer.shares.get(participant)
    assert.equal(verifyBeaconShare(participant, share, dealer.commitments), true)
    assert.equal(verifyBeaconShare(participant, share + 1n, dealer.commitments), false)
  }
})

test('reconstructs one proof from any threshold subset', () => {
  const { commitments, secretShares } = ceremony()
  const message = beaconMessage('leofcoin', 2n, 9n, new Uint8Array(96))
  const signatureShares = participants.map((participant) => ({
    participant,
    signature: signBeaconRound(secretShares.get(participant), message)
  }))

  for (const share of signatureShares) {
    const publicShare = deriveBeaconPublicShare(share.participant, commitments)
    assert.equal(verifyBeaconSignatureShare(share.signature, message, publicShare), true)
  }

  const first = reconstructBeaconSignature(signatureShares.slice(0, 3), threshold)
  const second = reconstructBeaconSignature(signatureShares.slice(1, 4).reverse(), threshold)
  const groupPublicKey = deriveBeaconGroupPublicKey(commitments)
  assert.deepEqual(first, second)
  assert.equal(verifyBeaconProof(first, message, groupPublicKey), true)
  assert.deepEqual(beaconRandomness(first), beaconRandomness(second))
})

test('binds proofs to network, epoch, round, and previous proof', () => {
  const { commitments, secretShares } = ceremony()
  const message = beaconMessage('leofcoin', 2n, 9n, new Uint8Array(96))
  const shares = participants.slice(0, threshold).map((participant) => ({
    participant,
    signature: signBeaconRound(secretShares.get(participant), message)
  }))
  const proof = reconstructBeaconSignature(shares, threshold)
  const groupPublicKey = deriveBeaconGroupPublicKey(commitments)
  assert.equal(verifyBeaconProof(proof, message, groupPublicKey), true)
  assert.equal(
    verifyBeaconProof(proof, beaconMessage('other-network', 2n, 9n, new Uint8Array(96)), groupPublicKey),
    false
  )
  assert.equal(verifyBeaconProof(proof, beaconMessage('leofcoin', 2n, 10n, new Uint8Array(96)), groupPublicKey), false)
})

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

test('Noble 2 preserves the established compressed BLS key and signature bytes', () => {
  // Fixed vector captured from Noble 1, not recomputed by the new implementation.
  const publicKey = Uint8Array.from(Buffer.from('80fd75ebcc0a21649e3177bcce15426da0e4f25d6828fbf4038d4d7ed3bd4421de3ef61d70f794687b12b2d571971a55', 'hex'))
  const signature = Uint8Array.from(Buffer.from('a1a1e604a80c69bf4423b0e841b30aafd7c8c94a772764ee3f7727b344e633d93c25e677e262c1649de0737c486ccea313e83699d1152546e04b8ac2f512a64dde2e7cc756d4d3a733841c559a610c559c8353db236347d856f378a74db0819b', 'hex'))
  const message = Uint8Array.of(1, 2, 3)
  assert.deepEqual(signBeaconRound(11n, message), signature)
  assert.equal(verifyBeaconProof(signature, message, publicKey), true)
  assert.equal(verifyBeaconProof(signature, Uint8Array.of(1, 2, 4), publicKey), false)
})

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

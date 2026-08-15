import { bls12_381 as bls } from '@noble/curves/bls12-381'
import { sha256 } from '@noble/hashes/sha256'

const encoder = new TextEncoder()
const Fr = bls.fields.Fr
const G1 = bls.G1.ProjectivePoint
const G2 = bls.G2.ProjectivePoint

export type BeaconDealerContribution = {
  commitments: Uint8Array[]
  shares: Map<bigint, bigint>
}

export type BeaconSignatureShare = {
  participant: bigint
  signature: Uint8Array
}

const assertParticipant = (participant: bigint) => {
  if (typeof participant !== 'bigint' || participant <= 0n || participant >= Fr.ORDER) {
    throw new TypeError('beacon participant identifiers must be non-zero field elements')
  }
}

const assertThreshold = (threshold: number, participantCount: number) => {
  if (!Number.isSafeInteger(threshold) || threshold < 2 || threshold > participantCount) {
    throw new RangeError('beacon threshold must be between 2 and the participant count')
  }
}

const assertUniqueParticipants = (participants: bigint[]) => {
  for (const participant of participants) assertParticipant(participant)
  if (new Set(participants).size !== participants.length) throw new Error('duplicate beacon participant')
}

const evaluatePolynomial = (coefficients: bigint[], x: bigint) => {
  let result = 0n
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    result = Fr.add(Fr.mul(result, x), coefficients[index])
  }
  return result
}

const evaluateCommitments = (commitments: Uint8Array[], x: bigint) => {
  let result = G1.ZERO
  let power = 1n
  for (const encoded of commitments) {
    const commitment = G1.fromHex(encoded)
    commitment.assertValidity()
    result = result.add(commitment.multiply(power))
    power = Fr.mul(power, x)
  }
  return result
}

const sumPoints = (points: Uint8Array[]) => {
  let result = G1.ZERO
  for (const encoded of points) {
    const point = G1.fromHex(encoded)
    point.assertValidity()
    result = result.add(point)
  }
  return result
}

const lagrangeAtZero = (participant: bigint, participants: bigint[]) => {
  let numerator = 1n
  let denominator = 1n
  for (const other of participants) {
    if (other === participant) continue
    numerator = Fr.mul(numerator, Fr.neg(other))
    denominator = Fr.mul(denominator, Fr.sub(participant, other))
  }
  return Fr.mul(numerator, Fr.inv(denominator))
}

/** Create one validator's Feldman-VSS contribution to a dealerless DKG ceremony. */
export const createBeaconContribution = (
  participants: bigint[],
  threshold: number,
  randomScalar: () => bigint
): BeaconDealerContribution => {
  assertUniqueParticipants(participants)
  assertThreshold(threshold, participants.length)
  const coefficients = Array.from({ length: threshold }, () => {
    const scalar = Fr.create(randomScalar())
    if (scalar === 0n) throw new Error('beacon contribution contains a zero coefficient')
    return scalar
  })
  return {
    commitments: coefficients.map((coefficient) => G1.BASE.multiply(coefficient).toRawBytes(true)),
    shares: new Map(participants.map((participant) => [participant, evaluatePolynomial(coefficients, participant)]))
  }
}

/** Verify a private share against the dealer's public polynomial commitments. */
export const verifyBeaconShare = (participant: bigint, share: bigint, commitments: Uint8Array[]): boolean => {
  try {
    assertParticipant(participant)
    if (commitments.length < 2) return false
    return G1.BASE.multiply(Fr.create(share)).equals(evaluateCommitments(commitments, participant))
  } catch {
    return false
  }
}

/** Combine one valid share from every accepted dealer into this validator's DKG secret share. */
export const combineBeaconShares = (shares: bigint[]): bigint => {
  if (shares.length < 2) throw new Error('at least two dealer shares are required')
  return shares.reduce((total, share) => Fr.add(total, Fr.create(share)), 0n)
}

/** Derive the public verification key corresponding to a participant's combined secret share. */
export const deriveBeaconPublicShare = (participant: bigint, dealerCommitments: Uint8Array[][]): Uint8Array => {
  assertParticipant(participant)
  if (dealerCommitments.length < 2) throw new Error('at least two dealer commitments are required')
  return sumPoints(
    dealerCommitments.map((commitments) => evaluateCommitments(commitments, participant).toRawBytes(true))
  ).toRawBytes(true)
}

/** The DKG group public key is the sum of every accepted dealer's constant commitment. */
export const deriveBeaconGroupPublicKey = (dealerCommitments: Uint8Array[][]): Uint8Array => {
  if (dealerCommitments.length < 2 || dealerCommitments.some((commitments) => commitments.length < 2)) {
    throw new Error('invalid beacon dealer commitments')
  }
  return sumPoints(dealerCommitments.map((commitments) => commitments[0])).toRawBytes(true)
}

export const beaconMessage = (network: string, epoch: bigint, round: bigint, previousProof: Uint8Array) => {
  if (!network || epoch < 0n || round < 0n) throw new TypeError('invalid beacon round')
  const prefix = encoder.encode(`leofcoin-beacon-v1:${network}:${epoch}:${round}:`)
  const message = new Uint8Array(prefix.length + previousProof.length)
  message.set(prefix)
  message.set(previousProof, prefix.length)
  return message
}

export const signBeaconRound = (secretShare: bigint, message: Uint8Array): Uint8Array =>
  bls.sign(message, Fr.create(secretShare))

export const verifyBeaconSignatureShare = (
  signature: Uint8Array,
  message: Uint8Array,
  publicShare: Uint8Array
): boolean => {
  try {
    return bls.verify(signature, message, publicShare)
  } catch {
    return false
  }
}

/** Reconstruct the unique threshold signature; input order and valid signer subset cannot change it. */
export const reconstructBeaconSignature = (rawShares: BeaconSignatureShare[], threshold: number): Uint8Array => {
  if (!Number.isSafeInteger(threshold) || threshold < 2) throw new RangeError('invalid beacon threshold')
  const shares = [...rawShares].sort((left, right) => (left.participant < right.participant ? -1 : 1))
  if (shares.length < threshold) throw new Error('not enough beacon signature shares')
  const selected = shares.slice(0, threshold)
  const participants = selected.map(({ participant }) => participant)
  assertUniqueParticipants(participants)

  let signature = G2.ZERO
  for (const share of selected) {
    const point = bls.Signature.fromHex(share.signature)
    point.assertValidity()
    signature = signature.add(point.multiply(lagrangeAtZero(share.participant, participants)))
  }
  return bls.Signature.toRawBytes(signature)
}

export const verifyBeaconProof = (proof: Uint8Array, message: Uint8Array, groupPublicKey: Uint8Array): boolean => {
  try {
    return bls.verify(proof, message, groupPublicKey)
  } catch {
    return false
  }
}

/** Hash the unique proof so consumers never interpret elliptic-curve encodings as uniform bytes. */
export const beaconRandomness = (proof: Uint8Array): Uint8Array => {
  if (proof.length !== 96) throw new Error('invalid BLS beacon proof length')
  return sha256(proof)
}

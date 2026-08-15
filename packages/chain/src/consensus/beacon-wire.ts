import { createTransactionHash, signTransaction } from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'

export type BeaconCommitmentData = {
  commitments: unknown
  epoch: unknown
  from: unknown
  participant: unknown
  signature?: unknown
  threshold: unknown
}

export type BeaconShareData = {
  epoch: unknown
  from: unknown
  participant: unknown
  round: unknown
  signature?: unknown
  signatureShare: unknown
}

export type BeaconActivationData = {
  configDigest: unknown
  epoch: unknown
  from: unknown
  signature?: unknown
}

const validInteger = (value: unknown, minimum = 0n) => {
  try {
    return BigInt(value as any) >= minimum
  } catch {
    return false
  }
}

export const validateBeaconCommitmentData = (message: BeaconCommitmentData): boolean => {
  if (
    !validInteger(message.epoch) ||
    !validInteger(message.participant, 1n) ||
    !validInteger(message.threshold, 2n) ||
    typeof message.from !== 'string' ||
    !message.from ||
    !Array.isArray(message.commitments)
  ) {
    return false
  }
  const threshold = Number(message.threshold)
  if (!Number.isSafeInteger(threshold) || message.commitments.length !== threshold) return false
  return message.commitments.every((commitment) => {
    if (typeof commitment !== 'string' || commitment.length > 128) return false
    try {
      return fromBase58(commitment).length === 48
    } catch {
      return false
    }
  })
}

export const validateBeaconShareData = (message: BeaconShareData): boolean => {
  if (
    !validInteger(message.epoch) ||
    !validInteger(message.round) ||
    !validInteger(message.participant, 1n) ||
    typeof message.from !== 'string' ||
    !message.from ||
    typeof message.signatureShare !== 'string' ||
    message.signatureShare.length > 256
  ) {
    return false
  }
  try {
    return fromBase58(message.signatureShare).length === 96
  } catch {
    return false
  }
}

export const validateBeaconActivationData = (message: BeaconActivationData): boolean => {
  if (
    !validInteger(message.epoch) ||
    typeof message.from !== 'string' ||
    !message.from ||
    typeof message.configDigest !== 'string' ||
    message.configDigest.length > 64
  )
    return false
  try {
    return fromBase58(message.configDigest).length === 32
  } catch {
    return false
  }
}

const commitmentSignableData = (validatorsAddress: string, message: BeaconCommitmentData) => ({
  from: String(message.from),
  to: validatorsAddress,
  method: 'beacon:commitment',
  params: [
    String(message.epoch),
    String(message.threshold),
    String(message.participant),
    ...(message.commitments as unknown[]).map(String)
  ],
  timestamp: 0
})

const shareSignableData = (validatorsAddress: string, message: BeaconShareData) => ({
  from: String(message.from),
  to: validatorsAddress,
  method: 'beacon:share',
  params: [String(message.epoch), String(message.round), String(message.participant), String(message.signatureShare)],
  timestamp: 0
})

const activationSignableData = (validatorsAddress: string, message: BeaconActivationData) => ({
  from: String(message.from),
  to: validatorsAddress,
  method: 'beacon:activation',
  params: [String(message.epoch), String(message.configDigest)],
  timestamp: 0
})

export const signBeaconCommitmentMessage = async (
  validatorsAddress: string,
  message: BeaconCommitmentData,
  identity: { sign: (input: Uint8Array) => Promise<Uint8Array> }
): Promise<string> => {
  if (!validateBeaconCommitmentData(message)) throw new Error('invalid beacon commitment')
  return (await signTransaction(commitmentSignableData(validatorsAddress, message), identity)).signature
}

export const signBeaconShareMessage = async (
  validatorsAddress: string,
  message: BeaconShareData,
  identity: { sign: (input: Uint8Array) => Promise<Uint8Array> }
): Promise<string> => {
  if (!validateBeaconShareData(message)) throw new Error('invalid beacon signature share')
  return (await signTransaction(shareSignableData(validatorsAddress, message), identity)).signature
}

export const signBeaconActivationMessage = async (
  validatorsAddress: string,
  message: BeaconActivationData,
  identity: { sign: (input: Uint8Array) => Promise<Uint8Array> }
): Promise<string> => {
  if (!validateBeaconActivationData(message)) throw new Error('invalid beacon activation')
  return (await signTransaction(activationSignableData(validatorsAddress, message), identity)).signature
}

const verifyIdentitySignature = async (message, signable, network: string) => {
  if (typeof message.signature !== 'string' || !message.signature) return false
  try {
    const verifier = new MultiWallet(network)
    await verifier.fromAddress(message.from, null, network)
    return verifier.verify(fromBase58(message.signature), await createTransactionHash(signable))
  } catch {
    return false
  }
}

export const verifyBeaconCommitmentMessage = async (
  validatorsAddress: string,
  message: BeaconCommitmentData,
  network: string
): Promise<boolean> =>
  validateBeaconCommitmentData(message) &&
  verifyIdentitySignature(message, commitmentSignableData(validatorsAddress, message), network)

export const verifyBeaconShareMessage = async (
  validatorsAddress: string,
  message: BeaconShareData,
  network: string
): Promise<boolean> =>
  validateBeaconShareData(message) &&
  verifyIdentitySignature(message, shareSignableData(validatorsAddress, message), network)

export const verifyBeaconActivationMessage = async (
  validatorsAddress: string,
  message: BeaconActivationData,
  network: string
): Promise<boolean> =>
  validateBeaconActivationData(message) &&
  verifyIdentitySignature(message, activationSignableData(validatorsAddress, message), network)

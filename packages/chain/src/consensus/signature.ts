import { createTransactionHash, signTransaction } from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'

export type ConsensusMessageType = 'proposal' | 'prevote' | 'precommit'
export type ConsensusMessageData = {
  blockHash: unknown
  index: unknown
  round: unknown
  from: unknown
  signature?: unknown
}

export const consensusSignableData = (
  validatorsAddress: string,
  type: ConsensusMessageType,
  message: ConsensusMessageData
) => ({
  from: String(message.from),
  to: validatorsAddress,
  method: `consensus:${type}`,
  params: [String(message.blockHash), String(message.index), String(message.round)],
  timestamp: 0
})

export const signConsensusMessage = async (
  validatorsAddress: string,
  type: ConsensusMessageType,
  message: ConsensusMessageData,
  identity: { sign: (input: Uint8Array) => Promise<Uint8Array> }
): Promise<string> => {
  if (!identity) throw new Error(`cannot sign ${type} without a local identity`)
  const signed = await signTransaction(consensusSignableData(validatorsAddress, type, message), identity)
  return signed.signature
}

export const verifyConsensusMessage = async (
  validatorsAddress: string,
  type: ConsensusMessageType,
  message: ConsensusMessageData,
  network: string
): Promise<boolean> => {
  if (typeof message.from !== 'string' || typeof message.signature !== 'string' || !message.signature) return false

  try {
    const verifier = new MultiWallet(network)
    await verifier.fromAddress(message.from, null, network)
    return await verifier.verify(
      fromBase58(message.signature),
      await createTransactionHash(consensusSignableData(validatorsAddress, type, message))
    )
  } catch {
    return false
  }
}

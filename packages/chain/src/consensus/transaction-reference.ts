import { TransactionMessage } from '@leofcoin/messages'

export const resolveTransactionReference = async (
  expectedHash: string,
  transactionData: Uint8Array | TransactionMessage
): Promise<TransactionMessage> => {
  const transaction =
    transactionData instanceof TransactionMessage ? transactionData : new TransactionMessage(transactionData)
  const actualHash = await transaction.hash()

  if (actualHash !== expectedHash) {
    throw new Error(`Transaction hash mismatch: expected ${expectedHash}, got ${actualHash}`)
  }

  return transaction
}

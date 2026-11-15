import { TransactionMessage } from '@leofcoin/messages'

export const TRANSACTION_REFERENCE_BATCH_SIZE = 128

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

export const loadTransactionReference = async (
  expectedHash: string,
  readPending: (hash: string) => Promise<Uint8Array | TransactionMessage>,
  readTransaction: (hash: string) => Promise<Uint8Array | TransactionMessage>
): Promise<TransactionMessage> => {
  let data: Uint8Array | TransactionMessage
  try {
    data = await readPending(expectedHash)
  } catch (error) {
    if (!error || typeof error !== 'object' || !('name' in error) || error.name !== 'NotFoundError') throw error
    data = await readTransaction(expectedHash)
  }
  if (!data) throw new Error(`missing transaction data for ${expectedHash}`)
  return resolveTransactionReference(expectedHash, data)
}

export const loadTransactionReferences = async (
  hashes: string[],
  readPendingBatch: (hashes: string[]) => Promise<Uint8Array[]>,
  readPending: (hash: string) => Promise<Uint8Array | TransactionMessage>,
  readTransaction: (hash: string) => Promise<Uint8Array | TransactionMessage>
): Promise<TransactionMessage[]> => {
  const transactions: TransactionMessage[] = []
  for (let offset = 0; offset < hashes.length; offset += TRANSACTION_REFERENCE_BATCH_SIZE) {
    const batch = hashes.slice(offset, offset + TRANSACTION_REFERENCE_BATCH_SIZE)
    let data: Uint8Array[] | undefined
    let missing = false
    try {
      data = await readPendingBatch(batch)
    } catch (error) {
      if (!error || typeof error !== 'object' || !('name' in error) || error.name !== 'NotFoundError') throw error
      missing = true
    }
    if (missing) {
      // A concurrent commit may remove only some entries; retry each reference.
      transactions.push(...await Promise.all(batch.map(hash => loadTransactionReference(hash, readPending, readTransaction))))
    } else {
      if (!Array.isArray(data) || data.length !== batch.length || Array.from(data).some(bytes => !(bytes instanceof Uint8Array)))
        throw new Error('Invalid transaction pool batch result')
      const entries = data
      transactions.push(...await Promise.all(batch.map((hash, index) => resolveTransactionReference(hash, entries[index]))))
    }
  }
  return transactions
}

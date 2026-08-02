interface HashableTransaction {
  hash(): Promise<string>
}

export interface PendingTransaction<T extends HashableTransaction> {
  transaction: T
  hash: string
}

/** Compare wire-decoded nonces without mixing number and bigint arithmetic. */
export const compareTransactionNonces = (
  left: number | bigint | string | undefined,
  right: number | bigint | string | undefined
): number => {
  const leftNonce = BigInt(left ?? 0)
  const rightNonce = BigInt(right ?? 0)
  if (leftNonce < rightNonce) return -1
  if (leftNonce > rightNonce) return 1
  return 0
}

/** Remove transactions from the pending pool once they are already canonical. */
export const pruneCanonicalTransactions = async <T extends HashableTransaction>(
  transactions: T[],
  latestTransactionHashes: Iterable<string>,
  isStored: (hash: string) => Promise<boolean>,
  removePending: (hash: string) => Promise<unknown>
): Promise<PendingTransaction<T>[]> => {
  const latest = new Set(latestTransactionHashes)
  const pending: PendingTransaction<T>[] = []

  for (const transaction of transactions) {
    const hash = await transaction.hash()
    if (latest.has(hash) || (await isStored(hash))) {
      await removePending(hash)
      continue
    }
    pending.push({ transaction, hash })
  }

  return pending
}

interface HashableTransaction {
  hash(): Promise<string>
}

export interface PendingTransaction<T extends HashableTransaction> {
  transaction: T
  hash: string
}

interface EnqueueableTransaction extends HashableTransaction {
  encoded: Uint8Array
  decoded: { from: string; nonce: number }
}

export interface TransactionPoolOps {
  putToPool: (hash: string, data: Uint8Array) => Promise<unknown>
  hasInPool: (hash: string) => Promise<boolean>
  addPendingNonce: (address: string, nonce: number) => void
}

/** Persist a validated transaction once and index its nonce on every receiving node. */
export const enqueueTransaction = async <T extends EnqueueableTransaction>(
  transaction: T,
  ops: TransactionPoolOps
): Promise<string> => {
  const hash = await transaction.hash()
  if (!(await ops.hasInPool(hash))) {
    await ops.putToPool(hash, transaction.encoded)
  }
  ops.addPendingNonce(transaction.decoded.from, transaction.decoded.nonce)
  return hash
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

type NonceTransaction = { decoded: { from: string; nonce: number | bigint | string; priority?: boolean } }

export const compareExecutionTransactions = (left: NonceTransaction, right: NonceTransaction): number =>
  compareTransactionNonces(left.decoded.nonce, right.decoded.nonce) ||
  Number(Boolean(right.decoded.priority)) - Number(Boolean(left.decoded.priority))

export async function validateConsecutiveNonces(
  transactions: NonceTransaction[],
  readCommitted: (address: string) => Promise<bigint>
): Promise<void> {
  const nonces = new Map<string, bigint>()
  for (const transaction of [...transactions].sort(compareExecutionTransactions)) {
    const { from, nonce } = transaction.decoded
    const committed = nonces.has(from) ? nonces.get(from)! : await readCommitted(from)
    const actual = BigInt(nonce)
    if (actual !== committed + 1n)
      throw new Error(`Transaction nonce out of sequence for ${from}: expected ${committed + 1n}, got ${actual}`)
    nonces.set(from, actual)
  }
}

/** Remove canonical transactions and entries superseded by committed nonces. */
export const pruneCanonicalTransactions = async <T extends HashableTransaction>(
  transactions: T[],
  latestTransactionHashes: Iterable<string>,
  removePending: (hash: string, transaction: T) => Promise<unknown>,
  isObsolete: (transaction: T) => Promise<boolean> = async () => false
): Promise<PendingTransaction<T>[]> => {
  const latest = new Set(latestTransactionHashes)
  const pending: PendingTransaction<T>[] = []

  for (const transaction of transactions) {
    const hash = await transaction.hash()
    if (latest.has(hash) || (await isObsolete(transaction))) {
      await removePending(hash, transaction)
      continue
    }
    pending.push({ transaction, hash })
  }

  return pending
}

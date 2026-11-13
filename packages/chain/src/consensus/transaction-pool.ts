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

type NonceTransaction = { decoded: { from: string; nonce?: number | bigint | string; priority?: unknown } }

export const compareExecutionTransactions = (left: NonceTransaction, right: NonceTransaction): number =>
  compareTransactionNonces(left.decoded.nonce, right.decoded.nonce) ||
  Number(Boolean(right.decoded.priority)) - Number(Boolean(left.decoded.priority))

/** Preserve the original 0.5 priority-first order when replaying historical blocks. */
export const compareLegacyExecutionTransactions = (left: NonceTransaction, right: NonceTransaction): number =>
  Number(Boolean(right.decoded.priority)) - Number(Boolean(left.decoded.priority)) ||
  compareTransactionNonces(left.decoded.nonce, right.decoded.nonce)

interface IndexedTransaction {
  hash: string
  from: string
  nonce: bigint
  priority: boolean
}

interface SenderTransactions {
  committed: bigint
  nonces: Map<bigint, Map<string, IndexedTransaction>>
}

const compareIndexed = (left: IndexedTransaction, right: IndexedTransaction) =>
  compareTransactionNonces(left.nonce, right.nonce) ||
  Number(right.priority) - Number(left.priority) ||
  (left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0)

/** Metadata only; signed bodies stay in the durable pool. */
export class PendingTransactionIndex {
  #entries = new Map<string, IndexedTransaction>()
  #senders = new Map<string, SenderTransactions>()
  #revision = 0

  get size() { return this.#entries.size }
  get revision() { return this.#revision }

  clear() {
    this.#entries.clear()
    this.#senders.clear()
    this.#revision++
  }

  add(hash: string, transaction: NonceTransaction, committed: bigint) {
    if (this.#entries.has(hash)) return
    const { from, nonce, priority } = transaction.decoded
    if (nonce === undefined) throw new Error('transaction nonce required')
    const entry = { hash, from, nonce: BigInt(nonce), priority: Boolean(priority) }
    if (entry.nonce <= committed) throw new Error('Cannot index an already committed nonce')
    let sender = this.#senders.get(from)
    if (!sender) {
      sender = { committed, nonces: new Map() }
      this.#senders.set(from, sender)
    }
    let alternatives = sender.nonces.get(entry.nonce)
    if (!alternatives) {
      alternatives = new Map()
      sender.nonces.set(entry.nonce, alternatives)
    }
    alternatives.set(hash, entry)
    this.#entries.set(hash, entry)
  }

  remove(hash: string): IndexedTransaction | undefined {
    const entry = this.#entries.get(hash)
    if (!entry) return
    this.#entries.delete(hash)
    const sender = this.#senders.get(entry.from)!
    const alternatives = sender.nonces.get(entry.nonce)!
    alternatives.delete(hash)
    if (!alternatives.size) sender.nonces.delete(entry.nonce)
    if (!sender.nonces.size) this.#senders.delete(entry.from)
    return entry
  }

  hasNonce(from: string, nonce: bigint) {
    return this.#senders.get(from)?.nonces.has(nonce) ?? false
  }

  commit(from: string, nonce: bigint): IndexedTransaction[] {
    this.#revision++
    const sender = this.#senders.get(from)
    if (!sender || nonce <= sender.committed) return []
    const removed: IndexedTransaction[] = []
    // Historical nonces can jump arbitrarily; never iterate the numeric gap
    // when scanning the retained nonce keys would be cheaper.
    const range = function* () {
      for (let next = sender.committed + 1n; next <= nonce; next++) yield next
    }
    const nonces = nonce - sender.committed <= BigInt(sender.nonces.size) ? range() : sender.nonces.keys()
    for (const next of nonces) {
      if (next > nonce) continue
      const alternatives = sender.nonces.get(next)
      if (alternatives) for (const entry of [...alternatives.values()]) {
        this.remove(entry.hash)
        removed.push(entry)
      }
    }
    sender.committed = nonce
    return removed
  }

  #next(sender: SenderTransactions, nonce: bigint): IndexedTransaction | undefined {
    let best: IndexedTransaction | undefined
    for (const entry of sender.nonces.get(nonce)?.values() ?? []) {
      if (!best || compareIndexed(entry, best) < 0) best = entry
    }
    return best
  }

  *candidates(): Generator<IndexedTransaction, void, boolean | undefined> {
    const heap: IndexedTransaction[] = []
    const push = (entry: IndexedTransaction) => {
      let index = heap.length
      heap.push(entry)
      while (index > 0) {
        const parent = (index - 1) >> 1
        if (compareIndexed(heap[parent], entry) <= 0) break
        heap[index] = heap[parent]
        index = parent
      }
      heap[index] = entry
    }
    const pop = () => {
      const first = heap[0]
      const last = heap.pop()!
      if (heap.length) {
        let index = 0
        while (index * 2 + 1 < heap.length) {
          let child = index * 2 + 1
          if (child + 1 < heap.length && compareIndexed(heap[child + 1], heap[child]) < 0) child++
          if (compareIndexed(last, heap[child]) <= 0) break
          heap[index] = heap[child]
          index = child
        }
        heap[index] = last
      }
      return first
    }
    for (const sender of this.#senders.values()) {
      const entry = this.#next(sender, sender.committed + 1n)
      if (entry) push(entry)
    }
    while (heap.length) {
      const entry = pop()
      const selected = yield entry
      const sender = this.#senders.get(entry.from)
      if (selected !== false && sender) {
        const next = this.#next(sender, entry.nonce + 1n)
        if (next) push(next)
      }
    }
  }
}

export async function validateConsecutiveNonces(
  transactions: NonceTransaction[],
  readCommitted: (address: string) => Promise<bigint>
): Promise<void> {
  const nonces = new Map<string, bigint>()
  for (const transaction of [...transactions].sort(compareExecutionTransactions)) {
    const { from, nonce } = transaction.decoded
    if (nonce === undefined) throw new Error('transaction nonce required')
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

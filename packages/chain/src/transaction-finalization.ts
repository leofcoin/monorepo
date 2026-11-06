type PubSub = {
  subscribe: (topic: string, handler: (value: any) => void) => void
  unsubscribe: (topic: string, handler: (value: any) => void) => void
}

type TransactionPool = {
  delete: (hash: string) => Promise<unknown>
}

export const createCanonicalTransactionWaiter = (pubsub: PubSub, transactionPool: TransactionPool, hash: string) => {
  let cleanup = () => {}
  let cancel = (_reason: unknown) => {}
  const wait = new Promise<string>((resolve, reject) => {
    const completionTopic = `transaction.completed.${hash}`
    let settled = false
    cancel = (reason: unknown) => {
      if (settled) return
      settled = true
      reject({ hash, error: reason })
    }

    cleanup = () => {
      pubsub.unsubscribe('block-processed', blockProcessed)
      pubsub.unsubscribe(completionTopic, transactionCompleted)
    }

    const blockProcessed = (block) => {
      if (settled || !Array.isArray(block?.transactions) || !block.transactions.includes(hash)) return

      settled = true
      resolve(hash)
    }

    const transactionCompleted = async (result) => {
      // Execution may happen while a validator is only constructing a candidate
      // block. That success is speculative; canonical block processing below is
      // the only success signal exposed to callers.
      if (settled || result?.status === 'fulfilled') return

      settled = true
      try {
        await transactionPool.delete(hash)
        reject({ hash, error: result?.error })
      } catch (error) {
        reject({ hash, error, transactionError: result?.error })
      }
    }

    pubsub.subscribe('block-processed', blockProcessed)
    pubsub.subscribe(completionTopic, transactionCompleted)
  })
  // Promise reactions run after the synchronous event dispatch. Unsubscribing
  // inside a listener mutates little-pubsub's live handler array and can skip
  // other transaction waiters or throw after the block was already persisted.
  const finalized = wait.finally(() => cleanup())
  // The event may fail while sendTransaction is still awaiting local storage or
  // publication, before the caller can attach its own rejection handler.
  void finalized.catch(() => {})
  return { wait: finalized, cancel }
}

export const waitForCanonicalTransaction = (pubsub: PubSub, transactionPool: TransactionPool, hash: string) =>
  createCanonicalTransactionWaiter(pubsub, transactionPool, hash).wait

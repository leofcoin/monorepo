type PubSub = {
  subscribe: (topic: string, handler: (value: any) => void) => void
  unsubscribe: (topic: string, handler: (value: any) => void) => void
}

type TransactionPool = {
  delete: (hash: string) => Promise<unknown>
}

export const waitForCanonicalTransaction = (pubsub: PubSub, transactionPool: TransactionPool, hash: string) =>
  new Promise<string>((resolve, reject) => {
    const completionTopic = `transaction.completed.${hash}`

    const cleanup = () => {
      pubsub.unsubscribe('block-processed', blockProcessed)
      pubsub.unsubscribe(completionTopic, transactionCompleted)
    }

    const blockProcessed = (block) => {
      if (!Array.isArray(block?.transactions) || !block.transactions.includes(hash)) return

      cleanup()
      resolve(hash)
    }

    const transactionCompleted = async (result) => {
      // Execution may happen while a validator is only constructing a candidate
      // block. That success is speculative; canonical block processing below is
      // the only success signal exposed to callers.
      if (result?.status === 'fulfilled') return

      await transactionPool.delete(hash)
      cleanup()
      reject({ hash, error: result?.error })
    }

    pubsub.subscribe('block-processed', blockProcessed)
    pubsub.subscribe(completionTopic, transactionCompleted)
  })

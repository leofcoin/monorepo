import Protocol from './protocol.js'
import { TransactionMessage, BlockMessage } from '@leofcoin/messages'
import {
  calculateFee,
  createTransactionHash,
  MAX_BLOCK_TRANSACTION_BYTES,
  MAX_BLOCK_TRANSACTIONS,
  MAX_TRANSACTION_BYTES
} from '@leofcoin/lib'
import { formatBytes } from '@leofcoin/utils'
import MultiWallet from '@leofcoin/multi-wallet'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'

export default class Transaction extends Protocol {
  #pendingNonces: Map<string, Set<number>> = new Map()
  #maxPendingNonce: Map<string, number> = new Map()

  constructor(config) {
    super(config)
  }

  addPendingNonce(address: string, nonce: number) {
    if (!this.#pendingNonces.has(address)) {
      this.#pendingNonces.set(address, new Set())
    }
    this.#pendingNonces.get(address)!.add(nonce)
    const currentMax = this.#maxPendingNonce.get(address) ?? -1
    if (nonce > currentMax) {
      this.#maxPendingNonce.set(address, nonce)
    }
  }

  removePendingNonce(address: string, nonce: number) {
    const nonces = this.#pendingNonces.get(address)
    if (!nonces) return

    nonces.delete(nonce)

    if (this.#maxPendingNonce.get(address) === nonce) {
      let max = -1
      for (const n of nonces) if (n > max) max = n
      if (max === -1) this.#maxPendingNonce.delete(address)
      else this.#maxPendingNonce.set(address, max)
    }
  }

  getPendingNonces(address: string): Set<number> {
    return this.#pendingNonces.get(address) || new Set()
  }

  getMaxPendingNonce(address: string): number {
    return this.#maxPendingNonce.get(address) ?? -1
  }

  /**
   *
   * @param {Address[]} transactions
   * @returns transactions to include
   */
  async getTransactions(transactions) {
    return new Promise(async (resolve, reject) => {
      let size = 0
      const _transactions = []
      for (const rawTransaction of transactions) {
        const tx = await new TransactionMessage(rawTransaction)
        if (tx.encoded.length > MAX_TRANSACTION_BYTES) continue
        const newSize = size + tx.encoded.length
        if (newSize > MAX_BLOCK_TRANSACTION_BYTES || _transactions.length >= MAX_BLOCK_TRANSACTIONS) break
        size = newSize
        _transactions.push({ ...tx.decoded, hash: await tx.hash() })
      }

      return resolve(_transactions)
    })
  }

  /**
   *
   * @param {Transaction[]} transactions An array containing Transactions
   * @returns {TransactionMessage}
   */
  async promiseTransactions(transactions): Promise<TransactionMessage[]> {
    transactions = await Promise.all(transactions.map((tx) => new TransactionMessage(tx.encoded || tx)))
    return transactions
  }

  /**
   *
   * @param {Transaction[]} transactions An array containing Transactions
   * @returns {Object} {transaction.decoded, transaction.hash}
   */
  async promiseTransactionsContent(transactions) {
    transactions = await Promise.all(
      transactions.map(
        (tx) =>
          new Promise(async (resolve, reject) => {
            resolve({ ...tx.decoded, hash: await tx.hash() })
          })
      )
    )

    return transactions
  }

  /**
   * When a nonce isn't found for an address fallback to just checking the transactionnPoolStore
   * @param {Address} address
   * @returns {Number} nonce
   */
  async #getNonceFallback(address) {
    let transactions = await globalThis.transactionPoolStore.values()
    transactions = await this.promiseTransactions(transactions)
    transactions = transactions.filter((tx) => tx.decoded.from === address)
    transactions = await this.promiseTransactionsContent(transactions)
    // @ts-ignore
    if (this.lastBlock?.hash && transactions.length === 0 && this.lastBlock.hash !== '0x0') {
      // @ts-ignore
      let blockHash = this.lastBlock.hash
      try {
        while (blockHash && blockHash !== '0x0' && transactions.length === 0) {
          let rawBlock
          try {
            rawBlock = await globalThis.blockStore.get(blockHash)
          } catch {
            rawBlock = await globalThis.peernet.get(blockHash, 'block')
          }
          if (!rawBlock) break

          const block = await new BlockMessage(rawBlock)
          const blockTransactions = await Promise.all(
            block.decoded.transactions.map(async (hash) => {
              let rawTransaction
              try {
                rawTransaction = await globalThis.transactionStore.get(hash)
              } catch {
                // Fall through to the network lookup below.
              }
              if (!rawTransaction) rawTransaction = await globalThis.peernet.get(hash, 'transaction')
              return rawTransaction ? new TransactionMessage(rawTransaction) : undefined
            })
          )
          transactions = blockTransactions
            .filter((transaction): transaction is TransactionMessage => Boolean(transaction))
            .filter((transaction) => transaction.decoded.from === address)
            .map((transaction) => transaction.decoded)
          blockHash = block.decoded.previousHash
        }
      } catch {
        return 0
      }
    }
    if (transactions.length === 0) return 0

    // Optimize: find max nonce instead of sorting entire array
    let maxNonce = 0
    for (const tx of transactions) {
      if (tx.nonce > maxNonce) maxNonce = tx.nonce
    }
    return maxNonce
  }

  /**
   * Get amount of transactions by address
   * @param {Address} address The address to get the nonce for
   * @returns {Number} nonce
   */
  async getNonce(address) {
    // DO NOT use nonce cache here - multiple parallel calls could create race conditions
    // Instead, optimize the store queries and pool filtering
    try {
      if (!(await globalThis.accountsStore.has(address))) {
        const nonce = await this.#getNonceFallback(address)
        await globalThis.accountsStore.put(address, new TextEncoder().encode(String(nonce)))
      }
    } catch (error) {
      const nonce = await this.#getNonceFallback(address)
      await globalThis.accountsStore.put(address, new TextEncoder().encode(String(nonce)))
    }
    // Fast path: Use pending nonce index instead of full pool scan (O(1) vs O(n))
    let nonce = await globalThis.accountsStore.get(address)
    nonce = Number(new TextDecoder().decode(nonce))
    const maxPending = this.getMaxPendingNonce(address)
    if (maxPending > nonce) {
      return maxPending
    }
    return nonce
  }

  async validateNonce(address, nonce) {
    // Compare only against the COMMITTED nonce (accountsStore), not the pool max.
    // The pool may hold many future nonces from batch sends — rejecting lower nonces
    // because a higher one is already queued would break concurrent batch submission.
    let committedNonce: number
    try {
      if (await globalThis.accountsStore.has(address)) {
        const raw = await globalThis.accountsStore.get(address)
        committedNonce = Number(new TextDecoder().decode(raw))
      } else {
        committedNonce = await this.#getNonceFallback(address)
      }
    } catch {
      committedNonce = 0
    }

    if (committedNonce >= nonce) throw new Error(`a transaction with the same nonce already exists`)

    // Fast check using pending nonce index instead of full pool decode
    const pendingNonces = this.getPendingNonces(address)
    if (pendingNonces.has(nonce)) throw new Error(`a transaction with the same nonce already exists`)
  }

  isTransactionMessage(message) {
    if (message instanceof TransactionMessage) return true
    return false
  }

  async createTransactionMessage(transaction, signature) {
    return new TransactionMessage({ ...transaction, signature })
  }

  async validateTransactionSignature(message: TransactionMessage): Promise<void> {
    if (!this.isTransactionMessage(message)) message = await new TransactionMessage(message)

    const { from, signature } = message.decoded
    if (!from || typeof from !== 'string') throw new Error('transaction sender required')
    if (!signature || typeof signature !== 'string') throw new Error('transaction not signed')

    try {
      const network = globalThis.peernet?.network || 'leofcoin'
      const verifier = new MultiWallet(network)
      await verifier.fromAddress(from, null, network)
      const valid = await verifier.verify(fromBase58(signature), await createTransactionHash(message))
      if (!valid) throw new Error('signature does not match transaction sender')
    } catch (error) {
      if ((error as Error)?.message === 'signature does not match transaction sender') throw error
      throw new Error(`invalid transaction signature: ${(error as Error)?.message ?? error}`)
    }
  }

  async createTransaction(transaction) {
    return {
      ...transaction,
      timestamp: transaction.timestamp || Date.now(),
      nonce: transaction.nonce || (await this.getNonce(transaction.from)) + 1
    }
  }

  async sendTransaction(message) {
    if (!this.isTransactionMessage(message)) message = await new TransactionMessage(message)
    if (message.decoded.nonce === undefined) throw new Error(`nonce required`)

    await this.validateTransactionSignature(message)
    await this.validateNonce(message.decoded.from, message.decoded.nonce)
    const hash = await message.hash()
    try {
      let data

      const wait = new Promise(async (resolve, reject) => {
        if (pubsub.hasSubscribers(`transaction.completed.${hash}`)) {
          const result = pubsub.getValue(`transaction.completed.${hash}`)
          if (result.status !== 'fulfilled') {
            await transactionPoolStore.delete(hash)
          }
          result.status === 'fulfilled' ? resolve(result.hash) : reject({ hash: result.hash, error: result.error })
        } else {
          const completed = async (result) => {
            if (result.status !== 'fulfilled') {
              await transactionPoolStore.delete(hash)
            }
            result.status === 'fulfilled' ? resolve(result.hash) : reject({ hash: result.hash, error: result.error })

            setTimeout(async () => {
              pubsub.unsubscribe(`transaction.completed.${hash}`, completed)
            }, 10_000)
          }
          pubsub.subscribe(`transaction.completed.${hash}`, completed)
        }
      })
      await globalThis.transactionPoolStore.put(hash, message.encoded)
      // Add to pending nonce index
      this.addPendingNonce(message.decoded.from, message.decoded.nonce)
      // debug(`Added ${hash} to the transaction pool`)
      try {
        peernet.publish('add-transaction', message.encoded)
      } catch (publishError) {
        console.warn('peernet publish failed: add-transaction', (publishError as Error)?.message ?? publishError)
      }
      const fee = await calculateFee(message.decoded)
      return { hash, data, fee, wait, message }
    } catch (error) {
      console.log('remo')

      await transactionPoolStore.delete(hash)
      this.removePendingNonce(message.decoded.from, message.decoded.nonce)
      throw error
    }
  }
}

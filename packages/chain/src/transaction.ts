import Protocol from './protocol.js'
import { chainNetwork } from './ledger-network.js'
import { TransactionMessage } from '@leofcoin/messages'
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
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { createCanonicalTransactionWaiter } from './transaction-finalization.js'
import { PendingTransactionIndex } from './consensus/transaction-pool.js'

export default class Transaction extends Protocol {
  #pendingNonces: Map<string, Set<number>> = new Map()
  #maxPendingNonce: Map<string, number> = new Map()
  #signatureChecks = new Map<string, Promise<void>>()
  protected pendingTransactions = new PendingTransactionIndex()

  constructor(config) {
    super(config)
  }

  protected async restorePendingTransactions() {
    this.clearPendingTransactionIndex()
    const committed = new Map<string, bigint>()
    for (const bytes of await globalThis.transactionPoolStore.values()) {
      const transaction = new TransactionMessage(bytes)
      const { from, nonce } = transaction.decoded
      if (nonce === undefined) throw new Error('transaction nonce required')
      if (!committed.has(from)) {
        const raw = await globalThis.accountsStore.has(from) ? await globalThis.accountsStore.get(from) : undefined
        committed.set(from, raw === undefined ? 0n : BigInt(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)))
      }
      const hash = await transaction.hash()
      if (BigInt(nonce) <= committed.get(from)!) {
        await globalThis.transactionPoolStore.delete(hash)
        continue
      }
      this.pendingTransactions.add(hash, transaction, committed.get(from)!)
      this.addPendingNonce(from, nonce)
    }
  }

  protected clearPendingTransactionIndex() {
    this.pendingTransactions.clear()
    this.#pendingNonces.clear()
    this.#maxPendingNonce.clear()
  }

  protected removePendingTransaction(hash: string) {
    const entry = this.pendingTransactions.remove(hash)
    if (entry && !this.pendingTransactions.hasNonce(entry.from, entry.nonce))
      this.removePendingNonce(entry.from, Number(entry.nonce))
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
   * Get amount of transactions by address
   * @param {Address} address The address to get the nonce for
   * @returns {Number} nonce
   */
  async getNonce(address) {
    const raw = await globalThis.accountsStore.has(address) ? await globalThis.accountsStore.get(address) : undefined
    const nonce = raw === undefined ? 0 : Number(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    const maxPending = this.getMaxPendingNonce(address)
    return Math.max(nonce, maxPending)
  }

  async validateNonce(address, nonce) {
    // Compare only against the COMMITTED nonce (accountsStore), not the pool max.
    // The pool may hold many future nonces from batch sends — rejecting lower nonces
    // because a higher one is already queued would break concurrent batch submission.
    const raw = await globalThis.accountsStore.has(address) ? await globalThis.accountsStore.get(address) : undefined
    const committedNonce = raw === undefined ? 0 : Number(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))

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

    const transaction = new TransactionMessage(structuredClone(message.decoded))
    const { from, signature } = transaction.decoded
    if (!from || typeof from !== 'string') throw new Error('transaction sender required')
    if (!signature || typeof signature !== 'string') throw new Error('transaction not signed')

    const network = chainNetwork('leofcoin')
    // Bind cached checks to a fresh snapshot, including the signature and network.
    const key = `${network}:${bytesToHex(sha256(transaction.encode()))}`
    const cached = this.#signatureChecks.get(key)
    if (cached) return cached

    const check = (async () => {
      try {
        const verifier = new MultiWallet(network)
        await verifier.fromAddress(from, null, network)
        const valid = await verifier.verify(fromBase58(signature), await createTransactionHash(transaction))
        if (!valid) throw new Error('signature does not match transaction sender')
      } catch (error) {
        if ((error as Error)?.message === 'signature does not match transaction sender') throw error
        throw new Error(`invalid transaction signature: ${(error as Error)?.message ?? error}`)
      }
    })()
    this.#signatureChecks.set(key, check)
    if (this.#signatureChecks.size > 4096) {
      const oldest = this.#signatureChecks.keys().next()
      if (!oldest.done) this.#signatureChecks.delete(oldest.value)
    }

    try {
      await check
    } catch (error) {
      if (this.#signatureChecks.get(key) === check) this.#signatureChecks.delete(key)
      throw error
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
    // Finish fallible preparation before allocating a waiter or admitting a tx.
    const fee = await calculateFee(message.decoded)
    const waiter = createCanonicalTransactionWaiter(pubsub, transactionPoolStore, hash)
    try {
      let data

      await globalThis.transactionPoolStore.put(hash, message.encoded)
      // Add to pending nonce index
      this.addPendingNonce(message.decoded.from, message.decoded.nonce)
      // debug(`Added ${hash} to the transaction pool`)
      try {
        await peernet.publish('add-transaction', message.encoded)
      } catch (publishError) {
        console.warn('peernet publish failed: add-transaction', (publishError as Error)?.message ?? publishError)
      }
      return { hash, data, fee, wait: waiter.wait, message }
    } catch (error) {
      waiter.cancel(error)
      try {
        await transactionPoolStore.delete(hash)
      } catch (cleanupError) {
        console.warn('failed to clean up rejected transaction:', cleanupError)
      } finally {
        this.removePendingNonce(message.decoded.from, message.decoded.nonce)
      }
      throw error
    }
  }
}

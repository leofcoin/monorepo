import Protocol from './protocol.js'
import { TransactionMessage, BlockMessage } from '@leofcoin/messages'
import { calculateFee } from '@leofcoin/lib'
import { formatBytes } from '@leofcoin/utils'

export default class Transaction extends Protocol {
  constructor(config) {
    super(config)
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

      const promises = await Promise.all(
        transactions.map(async (tx) => {
          tx = await new TransactionMessage(tx)
          size += tx.encoded.length
          if (
            !formatBytes(size).includes('MB') ||
            (formatBytes(size).includes('MB') && Number(formatBytes(size).split(' MB')[0]) <= 0.75)
          )
            _transactions.push({ ...tx.decoded, hash: await tx.hash() })
          else resolve(_transactions)
        })
      )

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
      let block = await peernet.get(this.lastBlock.hash, 'block')
      block = await new BlockMessage(block)

      // for (let tx of block.decoded?.transactions) {
      //   tx = await peernet.get(tx, 'transaction')
      //   transactions.push(new TransactionMessage(tx))
      // }
      transactions = transactions.filter((tx) => tx.from === address)
      while (transactions.length === 0 && block.decoded.index !== 0 && block.decoded.previousHash !== '0x0') {
        block = await globalThis.blockStore.get(block.decoded.previousHash)
        block = await new BlockMessage(block)
        transactions = block.decoded.transactions.filter((tx) => tx.from === address)
      }
    }
    if (transactions.length === 0) return 0

    transactions = transactions.sort((a, b) => a.timestamp - b.timestamp)
    return transactions[transactions.length - 1].nonce
  }

  /**
   * Get amount of transactions by address
   * @param {Address} address The address to get the nonce for
   * @returns {Number} nonce
   */
  async getNonce(address) {
    try {
      if (!(await globalThis.accountsStore.has(address))) {
        const nonce = await this.#getNonceFallback(address)
        await globalThis.accountsStore.put(address, new TextEncoder().encode(String(nonce)))
      }
    } catch (error) {
      const nonce = await this.#getNonceFallback(address)
      await globalThis.accountsStore.put(address, new TextEncoder().encode(String(nonce)))
    }
    // todo: are those in the pool in cluded also ? they need to be included!!!
    let nonce = await globalThis.accountsStore.get(address)
    nonce = new TextDecoder().decode(nonce)

    let transactions = await globalThis.transactionPoolStore.values()
    transactions = await this.promiseTransactions(transactions)
    transactions = transactions.filter((tx) => tx.decoded.from === address)
    transactions = await this.promiseTransactionsContent(transactions)
    for (const transaction of transactions) {
      if (transaction.nonce > nonce) nonce = transaction.nonce
    }
    return Number(nonce)
  }

  async validateNonce(address, nonce) {
    const previousNonce = await this.getNonce(address)
    if (previousNonce > nonce) throw new Error(`a transaction with a higher nonce already exists`)
    if (previousNonce === nonce) throw new Error(`a transaction with the same nonce already exists`)

    let transactions = await globalThis.transactionPoolStore.values()
    transactions = await this.promiseTransactions(transactions)
    transactions = transactions.filter((tx) => tx.decoded.from === address)

    for (const transaction of transactions) {
      if (transaction.decoded.nonce > nonce) throw new Error(`a transaction with a higher nonce already exists`)
      if (transaction.decoded.nonce === nonce) throw new Error(`a transaction with the same nonce already exists`)
    }
  }

  isTransactionMessage(message) {
    if (message instanceof TransactionMessage) return true
    return false
  }

  async createTransactionMessage(transaction, signature) {
    return new TransactionMessage({ ...transaction, signature })
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
    if (!message.decoded.signature) throw new Error(`transaction not signed`)
    if (message.decoded.nonce === undefined) throw new Error(`nonce required`)

    await this.validateNonce(message.decoded.from, message.decoded.nonce)
    // todo check if signature is valid
    const hash = await message.hash()
    try {
      let data

      const wait = new Promise(async (resolve, reject) => {
        if (pubsub.subscribers[`transaction.completed.${hash}`]) {
          const result = pubsub.subscribers[`transaction.completed.${hash}`].value
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
      // debug(`Added ${hash} to the transaction pool`)
      peernet.publish('add-transaction', message.encoded)
      const fee = await calculateFee(message.decoded)
      return { hash, data, fee, wait, message }
    } catch (error) {
      console.log('remo')

      await transactionPoolStore.delete(hash)
      throw error
    }
  }
}

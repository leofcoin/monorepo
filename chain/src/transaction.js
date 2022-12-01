import Protocol from "./protocol"
import MultiWallet from '@leofcoin/multi-wallet'
import {CodecHash} from '@leofcoin/codec-format-interface/dist/index'
import bs32 from '@vandeurenglenn/base32'

export default class Transaction extends Protocol {
  constructor() {
    super()
  }

  /**
   * 
   * @param {Address[]} transactions 
   * @returns transactions to include
   */
  async getTransactions (transactions) {
    return new Promise(async (resolve, reject) => {
      let size = 0
      const _transactions = []
      
      
      const promises = await Promise.all(transactions
        .map(async tx => {
          tx = await new TransactionMessage(tx)
          size += tx.encoded.length
          if (!formatBytes(size).includes('MB') || formatBytes(size).includes('MB') && Number(formatBytes(size).split(' MB')[0]) <= 0.75) _transactions.push({...tx.decoded, hash: await tx.hash})
          else resolve(_transactions)
        }))

      return resolve(_transactions)
    })
    
  }

  /**
   * 
   * @param {Transaction[]} transactions An array containing Transactions
   * @returns {TransactionMessage}
   */
  async promiseTransactions(transactions) {
    transactions = await Promise.all(transactions.map(tx => new TransactionMessage(tx)))
    return transactions
  }

  /**
   * 
   * @param {Transaction[]} transactions An array containing Transactions
   * @returns {Object} {transaction.decoded, transaction.hash}
   */
  async promiseTransactionsContent(transactions) {
    transactions = await Promise.all(transactions.map(tx => new Promise(async (resolve, reject) => {
      resolve({ ...tx.decoded, hash: await tx.hash })
    })))

    return transactions
  }

  /**
   * When a nonce isn't found for an address fallback to just checking the transactionnPoolStore
   * @param {Address} address 
   * @returns {Number} nonce
   */
  async #getNonceFallback(address) {
    let transactions = await transactionPoolStore.values()
    transactions = await this.promiseTransactions(transactions)
    transactions = transactions.filter(tx => tx.decoded.from === address)
    transactions = await this.promiseTransactionsContent(transactions)

    if (this.lastBlock?.hash && transactions.length === 0 && this.lastBlock.hash !==  '0x0') {
      
      let block = await peernet.get(this.lastBlock.hash)
      block = await new BlockMessage(block)

      // for (let tx of block.decoded?.transactions) {
      //   tx = await peernet.get(tx, 'transaction')
      //   transactions.push(new TransactionMessage(tx))
      // }
      transactions = transactions.filter(tx => tx.from === address)
      while (transactions.length === 0 && block.decoded.index !== 0 && block.decoded.previousHash !== '0x0') {
        block = await blockStore.get(block.decoded.previousHash)
        block = await new BlockMessage(block)
        transactions = block.decoded.transactions.filter(tx => tx.from === address)
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
    if (!await accountsStore.has(address)) {
      const nonce = await this.#getNonceFallback(address)
      await accountsStore.put(address, new TextEncoder().encode(String(nonce)))
    }
    // todo: are those in the pool in cluded also ? they need to be included!!!
    let nonce = await accountsStore.get(address)
    nonce = new TextDecoder().decode(nonce)
    return Number(nonce)
  }

  /**
   * whenever method = createContract params should hold the contract hash
   *
   * example: [hash]
   * createTransaction('0x0', 'createContract', [hash])
   *
   * @param {String} to - the contract address for the contract to interact with
   * @param {String} method - the method/function to run
   * @param {Array} params - array of paramters to apply to the contract method
   * @param {Number} nonce - total transaction count [optional]
   */
  async createTransaction(to, method, parameters, nonce, signature) {
    return this.createTransactionFrom(peernet.selectedAccount, to, method, parameters, nonce)
  } 

  /**
   * 
   * @param {Transaction} transaction
   * @param {String} transaction.from address
   * @param {String} transaction.to address
   * @param {Object} transaction.params {}
   * @param {String} transaction.params.method get, call
   * @param {Buffer} transaction.params.data 
   * @returns 
   */
  async createTransactionHash(transaction) {
    // todo: validate  
    const peernetHash = await new CodecHash(transaction, {name: 'transaction-message'})
    return peernetHash.digest
  }

  /**
   * @param {Transaction} transaction
   * @param {object} wallet any wallet/signer that supports sign(RAWtransaction)
   */
  async #signTransaction (transaction, wallet) {
    return wallet.sign(await this.createTransactionHash(transaction))
  }

  /**
   * 
   * @param {RawTransaction} transaction 
   * @param {Signer} signer 
   * @returns {Transaction} a signed transaction
   */
  async signTransaction(transaction, signer) {
    let identity = await walletStore.get('identity')
    identity = JSON.parse(new TextDecoder().decode(identity))
    const wallet = new MultiWallet(peernet.network)
    wallet.recover(identity.mnemonic)
    const account = wallet.account(0).external(0)
    transaction.signature = await this.#signTransaction(transaction, account)
    transaction.signature = bs32.encode(transaction.signature)
    return transaction
  }

  /**
   * 
   * @param {Transaction} transaction
   * @param {Address} transaction.from
   * @param {Address} transaction.to
   * @param {String} transaction.method
   * @param {Array} transaction.params
   * @param {Number} transaction.nonce
   * 
   * @returns {RawTransaction} transaction
   */
  async ensureNonce(transaction) {
    if (!transaction.from) transaction.from = peernet.selectedAccount
    transaction.timestamp = Date.now()

    if (transaction.nonce === undefined) {
      transaction.nonce = await this.getNonce(transaction.from)
    } else {
      let nonce = await accountsStore.get(transaction.from)
      nonce = new TextDecoder().decode(nonce)
      if (transaction.nonce < nonce) throw new Error(`a transaction with a higher nonce already exists`)
      if (transaction.nonce === nonce) throw new Error(`a transaction with the same nonce already exists`)
    }
    return transaction
  }

  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   *
   * @param {Address} from - the sender address
   * @param {Address} to - the contract address for the contract to interact with
   * @param {String} method - the method/function to run
   * @param {Array} params - array of paramters to apply to the contract method
   * @param {Number} nonce - total transaction count [optional]
   */
  async createTransactionFrom(from, to, method, parameters, nonce) {
    try {
      const rawTransaction = await this.ensureNonce({from, to, nonce, method, params: parameters})    
      const transaction = await this.signTransaction(rawTransaction, from)
      const message = await new TransactionMessage(transaction)

      let data
      const wait = () => new Promise(async (resolve, reject) => {
        if (pubsub.subscribers[`transaction.completed.${await message.hash}`]) {
          const result = pubsub.subscribers[`transaction.completed.${await message.hash}`].value
          result.status === 'fulfilled' ? resolve(await result.hash) : reject({hash: await result.hash, error: result.error})
        } else {
          const completed = async result => {
            result.status === 'fulfilled' ? resolve(await result.hash) : reject({hash: await result.hash, error: result.error})
    
            setTimeout(async () => {
              pubsub.unsubscribe(`transaction.completed.${await message.hash}`, completed)
            }, 10_000)
          }
          pubsub.subscribe(`transaction.completed.${await message.hash}`, completed)
        }
      })
      await transactionPoolStore.put(await message.hash, message.encoded)
      peernet.publish('add-transaction', message.encoded)
      return {hash: await message.hash, data, fee: await calculateFee(message.decoded), wait}
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}

import { BigNumber } from './utils/utils'
import Machine from './machine'
import lib from './lib'

const { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } = lib
// check if browser or local
export default class Chain {
  #contractFactory = lib.contractFactory
  #nativeToken = lib.nativeToken
  #nameService = lib.nameService
  #validators = lib.validators
  #machine

  constructor() {
    return this.#init()
  }

  get nativeToken() {
    return this.#nativeToken
  }

  get validators() {
    return [...this.#validators]
  }

  #runEpoch() {
    setTimeout(async () => {
      await this.#createBlock()
      return this.#runEpoch()
    }, 1000);
  }

  async #init() {
    // this.node = await new Node()
    this.participants = []

    this.#machine = await new Machine()
    this.utils = { BigNumber }

    peernet.subscribe('add-block', this.#addBlock)

    peernet.subscribe('add-transaction', async transaction => {
      console.log(transaction);
      try {
        transaction = new TransactionMessage(transaction)
        await transactionPoolStore.put(transaction.hash, transaction.encoded)
      } catch (e) {
        throw Error('invalid transaction')
      }
    })
    return this
  }

  async #addBlock(block) {
    const blockMessage = new BlockMessage(block)
    for (let transaction of blockMessage.decoded.transactions) {
      try {
        transaction = await transactionPoolStore.get(transaction)
      } catch (e) {
        transaction = await peernet.get(transaction)
        try {
        } catch (e) {
          console.warn(`couldn't resolve ${transaction}`);
        }
      }
      transaction = new TransactionMessage(transaction)
      await transactionStore.put(transaction.hash, transaction.encoded)
      await transactionPoolStore.delete(transaction.hash)
      await this.#machine.execute(transaction.decoded.to, transaction.decoded.method, transaction.decoded.params)
      pubsub.publish(`transaction.completed`, transaction.hash)
      pubsub.publish(`transaction.completed.${transaction.hash}`, transaction.hash)
    }
    await blockStore.put(blockMessage.hash, blockMessage.encoded)
  }

  async participate() {
    // TODO: validate participant
    // hold min amount of 50k ART for 7 days
    // lock the 50k
    // introduce peer-reputation
    // peerReputation(peerId)
    // {bandwith: {up, down}, uptime}
    if (!await this.staticCall(this.#validators, 'has'))
    await this.createTransactionFrom(peernet.id, this.#validators, 'addValidator', [peernet.id])
    this.#runEpoch()
  }

  calculateFee(transaction) {
    // excluded from fees
    if (transaction.decoded.to === this.#validators) return 0
    // fee per gb
    return (transaction.encoded.length / 1024) / 1e-6
  }

  async #createBlock() {
    let transactions = await transactionPoolStore.get()
    if (Object.keys(transactions)?.length === 0 ) return
    let block = {
      transactions: [],
      validators: [],
      fees: 0
    }
    transactions = Object.keys(transactions).map(transaction => new TransactionMessage(transactions[transaction]))
    transactions = transactions.sort((a, b) => a.decoded.timestamp - b.decoded.timestamp)
    for (const transaction of transactions) {
      try {
        block.transactions.push(transaction.hash)
        block.fees += Number(lib.calculateFee(transaction))
      } catch (e) {
        throw Error(`invalid message ${key}`)
      }
    }
    const validators = await this.staticCall(this.#validators, 'validators')
    // block.validators = Object.keys(block.validators).reduce((set, key) => {
    //   if (block.validators[key].active) {
    //     push({
    //       address: key
    //     })
    //   }
    // }, [])
    for (const validator of Object.keys(validators)) {
      if (validators[validator].active) {
        const id = await peernet.peerMap.get(validator)
        if (id) {
          for (const peer of this.peers) {
            if (peer.connection.id === id) {
              let data = new BWMessageRequest()

              const node = await this.prepareMessage(id, data.encoded)
              try {
                const bw = await peer.request(node.encoded)
                block.validators.push({
                  address,
                  bw: bw.up + bw.down
                })
              } catch(e) {

              }

            }
          }
        } else if (peernet.id === validator) {
          block.validators.push({
            address: peernet.id,
            bw: peernet.bw.up + peernet.bw.down
          })

          }
        }

    }

    block.reward = '150'
    block.validators = block.validators.map(validator => {
      validator.reward = String(Number(block.fees) + block.reward / block.validators.length)
      delete validator.bw
      return validator
    })
    console.log(block);
    // block.validators = lib.calculateValidatorReward(block.validators, block.fees)

    block.index = this.lastBlock?.index || 0
    block.previousHash = this.lastBlock?.hash || '0x0'
    block.timestamp = new Date().getTime()

    const parts = String(block.fees).split('.')
    let decimals = 0
    if (parts[1]) {
      const potentional = parts[1].split('e')
      if (potentional[0] !== parts[1]) {
        parts[1] = potentional[0]
        decimals = Number(potentional[1]?.replace(/\-|\+/g, '')) + Number(potentional[0].length)
      } else {
        decimals = parts[1].length
      }

    }
    console.log(parts);
    block.fees = Number.parseFloat(String(block.fees)).toFixed(decimals)
    console.log(block.fees);
    try {
      console.log(block);
      let blockMessage = new BlockMessage(block)
      console.log({hash: blockMessage.hash});
      blockMessage = new BlockMessage(blockMessage.encoded)
      console.log({hash2: blockMessage.hash});
      peernet.publish('add-block', blockMessage.encoded)
      this.#addBlock(blockMessage.encoded)
      this.lastBlock = block
    } catch (e) {
      console.log(e);
      throw Error(`invalid block ${block}`)
    }




    // data = await this.#machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  /**
   * whenever method = createContract params should hold the contract hash
   *
   * example: [hash]
   * createTransaction('0x0', 'createContract', [hash])
   */
  createTransaction(to, method, params) {
    return this.createTransactionFrom(peernet.id, to, method, params)
  }
  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   */
  async createTransactionFrom(from, to, method, params) {
    let data
    let message = new TransactionMessage({timestamp: new Date().getTime(), from, to, method, params})
    message = new TransactionMessage(message.encoded)
    try {
      await transactionPoolStore.put(message.hash, message.encoded)
      peernet.publish('add-transaction', message.encoded)
    } catch (e) {
      throw e
    }
    const wait = () => new Promise((resolve, reject) => {
      const completed = () => {
        resolve()
        pubsub.unsubscribe(`transaction.completed.${message.hash}`, completed)
      }
      pubsub.subscribe(`transaction.completed.${message.hash}`, completed)
    })
    return {hash: message.hash, data, fee: lib.calculateFee(message), wait}
  }

  async createContractMessage(creator, contract, constructorParameters = []) {
    return new ContractMessage({
      creator,
      contract,
      constructorParameters
    })
  }

  async createContractAddress(creator, contract, constructorParameters = []) {
    return this.createContractMessage(creator, contract, constructorParameters)
      .hash
  }

  /**
   *
   */
  async deployContract(contract, params = []) {
    globalThis.msg = {sender: peernet.id, call: this.call}

    const hash = await this.createContractAddress(creator, contract, params)

    try {
      const tx = await this.createTransactionFrom(peernet.id, this.#contractFactory, 'deployContract', [hash, creator, contract, constructorParameters])
    } catch (e) {
      throw e
    }
    return this.#machine.addContract(message)
  }

  #createMessage(sender = peernet.id) {
    return {
      sender: peernet.id,
      call: this.call,
      staticCall: this.staticCall,
      delegate: this.delegate,
      staticDelegate: this.staticDelegate
    }
  }

  internalCall(sender, contract, method, params) {
    globalThis.msg = this.#createMessage(sender)

    return this.#machine.execute(contract, method, params)
  }

  call(contract, method, params) {
    globalThis.msg = this.#createMessage()

    return this.#machine.execute(contract, method, params)
  }

  staticCall(contract, method, params) {
    globalThis.msg = this.#createMessage()
    return this.#machine.get(contract, method, params)
  }

  delegate(contract, method, params) {
    globalThis.msg = this.#createMessage()

    return this.#machine.execute(contract, method, params)
  }

  staticDelegate(contract, method, params) {
    globalThis.msg = this.#createMessage()

    return this.#machine.get(contract, method, params)
  }

  mint(to, amount) {
    return this.call(this.#nativeToken, 'mint', [to, amount])
  }

  transfer(from, to, amount) {
    return this.call(this.#nativeToken, 'transfer', [from, to, amount])
  }

  get balances() {
    return this.staticCall(this.#nativeToken, 'balances')
  }

  deleteAll() {
    return this.#machine.deleteAll()
  }

  lookup(name) {
    return this.call(this.#nameService, 'lookup', [name])
  }
}

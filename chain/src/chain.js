
import { BigNumber, formatUnits, parseUnits, info } from './utils/utils'
import Machine from './machine'
import lib from './lib'

globalThis.BigNumber = BigNumber

const { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } = lib
// check if browser or local
export default class Chain {
  #contractFactory = lib.contractFactory
  #nativeToken = lib.nativeToken
  #nameService = lib.nameService
  #validators = lib.validators
  #blocks = []
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

  get blocks() {
    return [...this.#blocks]
  }

  #runEpoch() {
    setTimeout(async () => {
      await this.#createBlock()
      return this.#runEpoch()
    }, 10000);
  }

  async #setup() {
    await contractStore.put(lib.contractFactory, lib.contractFactoryMessage)
    await contractStore.put(lib.nativeToken, lib.nativeTokenMessage)
    await contractStore.put(lib.validators, lib.validatorsMessage)
    await contractStore.put(lib.nameService, lib.nameServiceMessage)
    console.log('handle native contracts');
    // handle native contracts
  }

  async #sync() {
    let promises = []
    for (const [id, peer] of peernet.peerMap.entries()) {
      for (const peer of peernet.peers) {
        if (peer.connection.id === id) {
          let data = new peernet.protos['peernet-request']({request: 'lastBlock'})

          const node = await peernet.prepareMessage(id, data.encoded)
          promises.push(peer.request(node.encoded))
        }
      }
    }

    promises = await Promise.allSettled(promises)
    console.log(promises);
    promises = promises.reduce((set, c) => {
      if (c.index > set.index) {
        set.index = c.index
        set.hash = c.hash
      }
      return set
    }, {index: 0})
    console.log(promises);
    // get lastblock
  }

  async #init() {
    // this.node = await new Node()
    this.participants = []
    const initialized = await contractStore.has(lib.contractFactory)
    if (!initialized) await this.#setup()

    this.#machine = await new Machine()
    this.utils = { BigNumber, formatUnits, parseUnits }

    await peernet.addRequestHandler('bw-request-message', () => {

      return new BWMessage(peernet.client.bw) || { up: 0, down: 0 }
    })

    await peernet.addRequestHandler('lastBlock', () => {
      return new peernet.protos['peernet-response']({response: new TextEncoder().encode(JSON.stringify({ hash: this.lastBlock?.hash, index: this.lastBlock?.index }))})
    })

    try {
      let localBlock = await chainStore.get('lastBlock')
      localBlock = await peernet.get(new TextDecoder().decode(new Uint8Array(localBlock.buffer, localBlock.buffer.byteOffset, localBlock.buffer.byteLength)))
      this.lastBlock = new BlockMessage(new Uint8Array(localBlock.buffer, localBlock.buffer.byteOffset, localBlock.buffer.byteLength))
      console.log(this.lastBlock.decoded.transactions);
    } catch (e) {
      await this.#sync()
      // this.#setup()
    }

    peernet.subscribe('add-block', this.#addBlock)

    peernet.subscribe('add-transaction', async transaction => {
      console.log({transaction});
      try {
        transaction = new TransactionMessage(transaction)
        await transactionPoolStore.put(transaction.hash, transaction.encoded)
      } catch (e) {
        throw Error('invalid transaction')
      }
    })

    // peernet.subscribe('lastBlock', async hash => {
    //   if (!await peernet.has(hash, 'block')) {
    //     let block = await peernet.get(hash, 'block')
    //     block = new BlockMessage(block)
    //     const index = this.lastBlock.index
    //     if (this.lastBlock.index < block.decoded.index) {
    //       // TODO: check if valid
    //       await this.resolveBlock(block.hash)
    //       this.lastBlock = this.#blocks[this.#blocks.length - 1]
    //       const blocksSynced = this.lastBlock.index - index
    //       info(`synced ${blocksSynced} ${blocksSynced < 1 ? 'blocks' : 'block'}`)
    //
    //       const end = this.#blocks.length - 1
    //       const start = (this.#blocks.length - 1) - blocksSynced
    //
    //       await this.#loadBlocks(this.#blocks.slice(start, end))
    //       await blockStore.put(this.lastBlock.hash, this.lastBlock.encoded)
    //       await chainStore.put('lastBlock', this.lastBlock.hash)
    //     }
    //   }

        // })
      pubsub.subscribe('peer:connected', async (peer) => {
        let node = new peernet.protos['peernet-request']({request: 'lastBlock'})
console.log(node);
console.log(peer.id);
        node = await peernet.prepareMessage(peer.id, node.encoded)
        console.log(node);
        let response = await peer.request(node.encoded)
        response = new Uint8Array(Object.values(response))
        console.log(new TextDecoder().decode(response));
        const proto = new globalThis.peernet.protos['peernet-message'](response)
        console.log('pd');
        console.log(new TextDecoder().decode(proto.decoded.data));
        response = new globalThis.peernet.protos['peernet-response'](proto.decoded.data)
        console.log({response});
        let lastBlock = JSON.parse(new TextDecoder().decode(response.decoded.response))
        console.log({lastBlock});
        if (this.lastBlock?.index < lastBlock.index) {
             // TODO: check if valid
             await this.resolveBlock(block.hash)
             this.lastBlock = this.#blocks[this.#blocks.length - 1]
             const blocksSynced = this.lastBlock.index - index
             info(`synced ${blocksSynced} ${blocksSynced < 1 ? 'blocks' : 'block'}`)

             const end = this.#blocks.length - 1
             const start = (this.#blocks.length - 1) - blocksSynced

             await this.#loadBlocks(this.#blocks.slice(start, end))
             await blockStore.put(this.lastBlock.hash, this.lastBlock.encoded)
             await chainStore.put('lastBlock', new TextEncoder().encode(this.lastBlock.hash))
           }
      })



    // load local blocks
    await this.resolveBlocks()
    return this
  }

  async resolveBlock(hash) {
    let block = await peernet.get(hash, 'block')
    block = new BlockMessage(new Uint8Array(block.buffer, block.buffer.byteOffset, block.buffer.byteLength))
    block = {...block.decoded, hash}
    this.#blocks[block.index] = block
    console.log(`loaded block: ${hash} @${block.index}`);
    if (block.index !== 0) {
      return this.resolveBlock(block.previousHash)
    }
  }

  async resolveBlocks() {
    try {
      const localBlock = await chainStore.get('lastBlock')
      await this.resolveBlock(new TextDecoder().decode(localBlock))
      this.lastBlock = this.#blocks[this.#blocks.length - 1]
      await this.#loadBlocks(this.#blocks)
    } catch (e) {
// console.log(e);
    }
  }

  async #loadBlocks(blocks) {
    for (const block of blocks) {
      let message = await peernet.get(block.hash, 'block')
      message = new BlockMessage(message)
      for (const hash of message.decoded.transactions) {
        let transaction = await peernet.get(hash, 'transaction')
        transaction = new TransactionMessage(transaction)
        try {
          await this.#machine.execute(transaction.decoded.to, transaction.decoded.method, transaction.decoded.params)
        } catch (e) {
// console.log(e);
        }
      }
    }
  }

  async #addBlock(block) {
    const blockMessage = new BlockMessage(block)
    // if (!Buffer.isBuffer(block)) block = Buffer.from(block, 'hex')
    const transactionJob = async transaction => {
      try {
        transaction = await transactionPoolStore.get(transaction)
      } catch (e) {
        try {
          transaction = await peernet.get(transaction, 'transaction')
        } catch (e) {
          console.warn(`couldn't resolve ${transaction}`);
        }
      }
      transaction = new TransactionMessage(new Uint8Array(transaction.buffer, transaction.buffer.byteOffset, transaction.buffer.byteLength))
      return transaction
    }


    let transactions = blockMessage.decoded.transactions.map(tx => transactionJob(tx))
    transactions = await Promise.all(transactions)
    for (let transaction of transactions) {
      await transactionStore.put(transaction.hash, transaction.encoded)
      await transactionPoolStore.delete(transaction.hash)
      try {
        await this.#machine.execute(transaction.decoded.to, transaction.decoded.method, transaction.decoded.params)
        pubsub.publish(`transaction.completed.${transaction.hash}`, {status: 'fulfilled', hash: transaction.hash})
      } catch (e) {
        pubsub.publish(`transaction.completed.${transaction.hash}`, {status: 'fail', hash: transaction.hash, error: e})
      }
    }
    this.lastBlock = {hash: blockMessage.hash, ...blockMessage.decoded}
    await blockStore.put(blockMessage.hash, blockMessage.encoded)
    await chainStore.put('lastBlock', new TextEncoder().encode(blockMessage.hash))
    info(`added block: ${blockMessage.hash}`)
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
    transactions = Object.keys(transactions).map(transaction => {
      const buffer = transactions[transaction]
      return new TransactionMessage(new Uint8Array(buffer, buffer.byteOffset, buffer.byteLength))
    })
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

              const node = await peernet.prepareMessage(id, data.encoded)
              try {
                const bw = await peer.request(node.encoded)
                console.log(bw);
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

    block.reward = 150
    block.validators = block.validators.map(validator => {
      validator.reward = String(Number(block.fees) + block.reward / block.validators.length)
      delete validator.bw
      return validator
    })
    // block.validators = lib.calculateValidatorReward(block.validators, block.fees)

    block.index = this.lastBlock?.index
    if (block.index === undefined) block.index = 0
    else block.index += 1

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
    block.fees = Number.parseFloat(String(block.fees)).toFixed(decimals)

    try {
      let blockMessage = new BlockMessage(block)
      this.lastBlock = {...block, hash: blockMessage.hash}
      peernet.publish('add-block', blockMessage.encoded.toString('hex'))
      this.#addBlock(blockMessage.encoded)
    } catch (e) {
      throw Error(`invalid block ${block}`)
    }
    // data = await this.#machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  async getNonce(address) {
    let transactions = await transactionPoolStore.get()
    transactions = Object.keys(transactions).map(tx => new TransactionMessage(transactions[tx]))
    transactions = transactions.filter(tx => tx.decoded.from === address)
    if (this.lastBlock && transactions.length === 0) {
      let block = this.lastBlock
      for (let tx of block.transactions) {
        tx = await peernet.get(tx, 'transaction')
        transactions.push(new TransactionMessage(tx))
      }
      transactions = transactions.filter(tx => tx.decoded.from === address)
      while (transactions.length === 0 && block.index !== 0) {
        block = await blockStore.get(block.previousHash)
        block = new BlockMessage(block)
        transactions = block.transactions.map(tx => new TransactionMessage(tx))
        transactions = transactions.filter(tx => tx.decoded.from === address)
      }

    }
    if (transactions.length === 0) return 0

    transactions = transactions.sort((a, b) => a.decoded.timestamp - b.decoded.timestamp)
    return transactions[transactions.length - 1].decoded.nonce
  }

  /**
   * whenever method = createContract params should hold the contract hash
   *
   * example: [hash]
   * createTransaction('0x0', 'createContract', [hash])
   */
  createTransaction(to, method, params, nonce) {
    return this.createTransactionFrom(peernet.id, to, method, params, nonce)
  }
  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   */
  async createTransactionFrom(from, to, method, params, nonce) {
    if (nonce === undefined) {
      nonce = await this.getNonce(from)
      nonce += 1
    }

    let data
    let message = new TransactionMessage({timestamp: new Date().getTime(), from, to, nonce, method, params})
    try {
      await transactionPoolStore.put(message.hash, message.encoded)
      peernet.publish('add-transaction', message.encoded)
    } catch (e) {
      throw e
    }
    const wait = () => new Promise((resolve, reject) => {
      const completed = result => {
        result.status === 'fulfilled' ? resolve(result.hash) : reject({hash: result.hash, error: result.error})

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

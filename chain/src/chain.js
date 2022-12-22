import { BigNumber, formatUnits, parseUnits, formatBytes } from '@leofcoin/utils'
import Machine from './machine.js'
import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import addresses, { nativeToken } from '@leofcoin/addresses'
import { contractFactoryMessage, nativeTokenMessage, validatorsMessage, nameServiceMessage, calculateFee } from '@leofcoin/lib'
import State from './state.js'
import Contract from './contract.js'

globalThis.BigNumber = BigNumber

// check if browser or local
export default class Chain  extends Contract {
  /** {Address[]} */
  #validators = []
  /** {Block[]} */
  #blocks = []

  #machine
  /** {Boolean} */
  #runningEpoch = false

  /** {Boolean} */
  #chainSyncing = false

  /** {Number} */
  #totalSize = 0

  /** 
   * {Block} {index, hash, previousHash}
   */
  #lastBlock = {index: 0, hash: '0x0', previousHash: '0x0'}

  /** 
   * amount the native token has been iteracted with
   */
  #nativeCalls = 0

  /** 
   * amount the native token has been iteracted with
   */
   #nativeTransfers = 0

  /** 
   * amount of native token burned
   * {Number}
   */
  #nativeBurns = 0

  /** 
   * amount of native tokens minted
   * {Number}
   */
  #nativeMints = 0

  /** 
   * total amount of transactions
   * {Number}
   */
   #totalTransactions = 0

  #participants = []
  #participating = false
  #jail = []

  constructor() {
    super()
    return this.#init()
  }

  get nativeMints() {
    return this.#nativeMints
  }

  get nativeBurns() {
    return this.#nativeBurns
  }
  
  get nativeTransfers() {
    return this.#nativeTransfers
  }

  get totalTransactions() {
    return this.#totalTransactions
  }

  get nativeCalls() {
    return this.#nativeCalls
  }

  get totalSize() {
    return this.#totalSize
  }

  get lib() {
    return lib
  }

  get lastBlock() {
    return this.#lastBlock
  }

  get nativeToken() {
    return addresses.nativeToken
  }

  get validators() {
    return [...this.#validators]
  }

  get blocks() {
    return [...this.#blocks]
  }

  async hasTransactionToHandle() {
    const size = await transactionPoolStore.size()
    if (size > 0) return true
    return false
  }

  async #runEpoch() {
    this.#runningEpoch = true
    console.log('epoch');
    const validators = await this.staticCall(addresses.validators, 'validators')
    console.log(validators);
    if (!validators[peernet.selectedAccount]?.active) return
    const start = Date.now()
    try {
      await this.#createBlock()
    } catch (error) {
      console.error(error);
    }
    
    const end = Date.now()
    console.log(((end - start) / 1000) + ' s');
    
    if (await this.hasTransactionToHandle()) return this.#runEpoch()
    this.#runningEpoch = false
    // if (await this.hasTransactionToHandle() && !this.#runningEpoch) return this.#runEpoch()
  }

  async #setup() {

    const contracts = [{
      address: addresses.contractFactory,
      message: contractFactoryMessage
    }, {
      address: addresses.nativeToken,
      message: nativeTokenMessage
    }, {
      address: addresses.validators,
      message: validatorsMessage
    }, {
      address: addresses.nameService,
      message: nameServiceMessage
    }]

    await Promise.all(contracts.map(async ({address, message}) => {
      message = await new ContractMessage(message)
      await contractStore.put(address, message.encoded)
    }))
    console.log('handle native contracts');
    // handle native contracts
  }

  promiseRequests(promises) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve([{index: 0, hash: '0x0'}])
        debug('sync timed out')
      }, 10_000)
  
      promises = await Promise.allSettled(promises);
      promises = promises.filter(({status}) => status === 'fulfilled')
      clearTimeout(timeout)

      promises = promises.map(({value}) => new peernet.protos['peernet-response'](value))
      promises = await Promise.all(promises)
      promises = promises.map(node => node.decoded.response)      
      resolve(promises)
    })
    
  }

  getLatestBlock() {
    return this.#getLatestBlock()
  }

  async #getLatestBlock() {
    let promises = [];
    
    let data = await new peernet.protos['peernet-request']({request: 'lastBlock'});
    const node = await peernet.prepareMessage(data);

    for (const peer of peernet.connections) {
      if (peer.connected && peer.readyState === 'open' && peer.peerId !== this.id) {        
        promises.push(peer.request(node.encoded));
      } else if (!peer.connected || peer.readyState !== 'open') {
        // todo: remove peer
        // reinitiate channel?
      }
    }
    promises = await this.promiseRequests(promises)
    let latest = {index: 0, hash: '0x0'}

    for (const value of promises) {      
      if (value.index > latest.index) {
        latest.index = value.index;
        latest.hash = await value.hash();
      }
    }
    
    if (latest.hash && latest.hash !== '0x0') {
      latest = await peernet.get(latest.hash, block)
      latest = await new BlockMessage(latest)
    }

    return latest
  }

  async #init() {
    // this.node = await new Node()
    this.#participants = []
    this.#participating = false
    const initialized = await contractStore.has(addresses.contractFactory)
    if (!initialized) await this.#setup()

   
    this.utils = { BigNumber, formatUnits, parseUnits }

    this.state = new State()
    
    try {
      let localBlock
      try {
        localBlock = await chainStore.get('lastBlock')
      } catch{
        await chainStore.put('lastBlock', '0x0')
        localBlock = await chainStore.get('lastBlock')
      }
      localBlock = new TextDecoder().decode(localBlock)
      if (localBlock && localBlock !== '0x0') {
        localBlock = await peernet.get(localBlock, 'block')
        localBlock = await new BlockMessage(localBlock)
        this.#lastBlock = {...localBlock.decoded, hash: await localBlock.hash()}
      } else {
        const latestBlock = await this.#getLatestBlock()
        await this.#syncChain(latestBlock)
      }      
    } catch (error) {
      console.log({e: error});
    }

    await peernet.addRequestHandler('bw-request-message', () => {

      return new BWMessage(peernet.client.bw) || { up: 0, down: 0 }
    })

    await peernet.addRequestHandler('lastBlock', this.#lastBlockHandler.bind(this))

    peernet.subscribe('add-block', this.#addBlock.bind(this))

    peernet.subscribe('add-transaction', this.#addTransaction.bind(this))

    peernet.subscribe('validator:timeout', this.#validatorTimeout.bind(this))

    pubsub.subscribe('peer:connected', this.#peerConnected.bind(this))

    
    // load local blocks
    await this.resolveBlocks()
    this.#machine = await new Machine(this.#blocks)
    await this.#loadBlocks(this.#blocks)
    return this
  }

  async #validatorTimeout(validatorInfo) {
    setTimeout(() => {
      this.#jail.splice(this.jail.indexOf(validatorInfo.address), 1)
    }, validatorInfo.timeout)
    this.#jail.push(validatorInfo.address)
  }

  async #syncChain(lastBlock) {
    if (this.#chainSyncing) return

    if (!this.lastBlock || Number(this.lastBlock.index) < Number(lastBlock.index)) {
      this.#chainSyncing = true
      // TODO: check if valid
      const localIndex = this.lastBlock ? this.lastBlock.index : 0
      const index = lastBlock.index
      await this.resolveBlock(lastBlock.hash)
      let blocksSynced = localIndex > 0 ? (localIndex > index ? localIndex - index : index - localIndex) : index
      debug(`synced ${blocksSynced} ${blocksSynced > 1 ? 'blocks' : 'block'}`)

      const end = this.#blocks.length
      const start = this.#blocks.length - blocksSynced
      await this.#loadBlocks(this.blocks.slice(start))
      await this.#updateState(this.#blocks[this.#blocks.length - 1])      
      this.#chainSyncing = false
    }
  }

  async #peerConnected(peer) {
    let node = await new peernet.protos['peernet-request']({request: 'lastBlock'})
    node = await peernet.prepareMessage(node)
    let response = await peer.request(node.encoded)
    response = await new globalThis.peernet.protos['peernet-response'](response)
    let lastBlock = response.decoded.response
    this.#syncChain(lastBlock)
 }

 #epochTimeout


async #lastBlockHandler() {
  return new peernet.protos['peernet-response']({response: { hash: this.#lastBlock?.hash, index: this.#lastBlock?.index }})
}

async resolveBlock(hash) {
  if (!hash)  throw new Error(`expected hash, got: ${hash}`)
  let block = await peernet.get(hash, 'block')
  block = await new BlockMessage(block)
  if (!await peernet.has(hash, 'block')) await peernet.put(hash, block.encoded, 'block')
  const size = block.encoded.length > 0 ? block.encoded.length : block.encoded.byteLength
  this.#totalSize += size
  block = {...block.decoded, hash}
  if (this.#blocks[block.index] && this.#blocks[block.index].hash !== block.hash) throw `invalid block ${hash} @${block.index}`
  this.#blocks[block.index] = block
  console.log(`resolved block: ${hash} @${block.index} ${formatBytes(size)}`);
  if (block.previousHash !== '0x0') {
    return this.resolveBlock(block.previousHash)
  }
}

  async resolveBlocks() {
    try {
      const localBlock = await chainStore.get('lastBlock')
      const hash = new TextDecoder().decode(localBlock)

      if (hash && hash !== '0x0')
        await this.resolveBlock(hash)
        this.#lastBlock = this.#blocks[this.#blocks.length - 1]
        
    } catch {
      await chainStore.put('lastBlock', new TextEncoder().encode('0x0'))
      return this.resolveBlocks()
// console.log(e);
    }
  }

  /**
   * 
   * @param {Block[]} blocks 
   */
  async #loadBlocks(blocks) {
    for (const block of blocks) {
      if (block && !block.loaded) {
        for (const transaction of block.transactions) {
          try {
            await this.#machine.execute(transaction.to, transaction.method, transaction.params)
            if (transaction.to === nativeToken) {
              this.#nativeCalls += 1
              if (transaction.method === 'burn') this.#nativeBurns += 1
              if (transaction.method === 'mint') this.#nativeMints += 1
              if (transaction.method === 'transfer') this.#nativeTransfers += 1
            }
            this.#totalTransactions += 1
          } catch (error) {
  console.log(error);
          }
        }
        this.#blocks[block.index].loaded = true
        debug(`loaded block: ${block.hash} @${block.index}`);
      }
    }
  }

  async #executeTransaction({hash, from, to, method, params, nonce}) {
    try {
      let result = await this.#machine.execute(to, method, params, from, nonce)
      // if (!result) result = this.#machine.state
      pubsub.publish(`transaction.completed.${hash}`, {status: 'fulfilled', hash})
      return result || 'no state change'
    } catch (error) {
      pubsub.publish(`transaction.completed.${hash}`, {status: 'fail', hash, error: error})
      throw error
    }
  }

  async #addBlock(block) {
    // console.log(block);
    const blockMessage = await new BlockMessage(new Uint8Array(Object.values(block)))
    await Promise.all(blockMessage.decoded.transactions
      .map(async transaction => transactionPoolStore.delete(transaction.hash)))
    const hash = await blockMessage.hash()
    
    await blockStore.put(hash, blockMessage.encoded)
    
    if (this.lastBlock.index < blockMessage.decoded.index) await this.#updateState(blockMessage)
    debug(`added block: ${hash}`)
    let promises = []
    let contracts = []
    for (let transaction of blockMessage.decoded.transactions) {
      // await transactionStore.put(transaction.hash, transaction.encoded)
      const index = contracts.indexOf(transaction.to)
      if (index === -1) contracts.push(transaction.to)
      // Todo: go trough all accounts      
      promises.push(this.#executeTransaction(transaction))
      
    }
    try {
      promises = await Promise.allSettled(promises)
      for (let transaction of blockMessage.decoded.transactions) {
        pubsub.publish('transaction-processed', transaction)
        if (transaction.to === peernet.selectedAccount) pubsub.publish('account-transaction-processed', transaction)        
        await accountsStore.put(transaction.from, String(transaction.nonce))
      }
      
      // todo finish state
      // for (const contract of contracts) {
      //   const state = await this.#machine.get(contract, 'state')
      //   // await stateStore.put(contract, state)
      //   console.log(state);
      // }

      
      pubsub.publish('block-processed', blockMessage.decoded)
      
    } catch (error) {
      console.log({e: error});
    }

  }

  async #updateState(message) {
    const hash = await message.hash()
    this.#lastBlock = { hash, ...message.decoded }
    await this.state.updateState(message)
    await chainStore.put('lastBlock', hash)
  }



  async participate(address) {
    // TODO: validate participant
    // hold min amount of 50k ART for 7 days
    // lock the 50k
    // introduce peer-reputation
    // peerReputation(peerId)
    // {bandwith: {up, down}, uptime}
    this.#participating = true
    if (!await this.staticCall(addresses.validators, 'has', [address])) await this.createTransactionFrom(address, addresses.validators, 'addValidator', [address])
    if (await this.hasTransactionToHandle() && !this.#runningEpoch) await this.#runEpoch()
  }

  // todo filter tx that need to wait on prev nonce
  async #createBlock(limit = 1800) {
    // vote for transactions
    if (await transactionPoolStore.size() === 0) return;

    let transactions = await transactionPoolStore.values(limit)

    if (Object.keys(transactions)?.length === 0 ) return
    
    let block = {
      transactions: [],
      validators: [],
      fees: BigNumber.from(0)
    }

    // exclude failing tx
    transactions = await this.getTransactions(transactions.slice(0, transactions.length < 1800 ? transactions.length : 1800))

    transactions = transactions.sort((a, b) => a.nonce - b.nonce)
    for (let transaction of transactions) { 
      try {
        await this.#executeTransaction(transaction)
        block.transactions.push(transaction)
        block.fees += Number(calculateFee(transaction))
        await accountsStore.put(transaction.from, new TextEncoder().encode(String(transaction.nonce)))
      } catch {
        transaction = await new TransactionMessage(transaction)
        await transactionPoolStore.delete(await transaction.hash())
      }
    }
    // don't add empty block
    if (block.transactions.length === 0) return
    const validators = await this.staticCall(addresses.validators, 'validators')
    console.log({validators});
    // block.validators = Object.keys(block.validators).reduce((set, key) => {
    //   if (block.validators[key].active) {
    //     push({
    //       address: key
    //     })
    //   }
    // }, [])
    const peers = {}
    for (const entry of peernet.peerEntries) {
      peers[entry[0]] = entry[1]
    }
    for (const validator of Object.keys(validators)) {
      if (validators[validator].active) {
        const peer = peers[validator]
        if (peer && peer.connected) {
          let data = await new BWRequestMessage()
          const node = await peernet.prepareMessage(validator, data.encoded)
          try {
            const bw = await peer.request(node.encoded)
            console.log({bw});
            block.validators.push({
              address: validator,
              bw: bw.up + bw.down
            })
          } catch{}

        } else if (peernet.selectedAccount === validator) {
          block.validators.push({
            address: peernet.selectedAccount,
            bw: peernet.bw.up + peernet.bw.down
          })

          }
        }

    }

    console.log({validators: block.validators});

    block.reward = 150
    block.validators = block.validators.map(validator => {
      validator.reward = String(Number(block.fees) + block.reward / block.validators.length)
      delete validator.bw
      return validator
    })
    // block.validators = calculateValidatorReward(block.validators, block.fees)

    block.index = this.lastBlock?.index
    if (block.index === undefined) block.index = 0
    else block.index += 1

    block.previousHash = this.lastBlock?.hash || '0x0'
    block.timestamp = Date.now()

    const parts = String(block.fees).split('.')
    let decimals = 0
    if (parts[1]) {
      const potentional = parts[1].split('e')
      if (potentional[0] === parts[1]) {
        decimals = parts[1].length
      } else {
        parts[1] = potentional[0]
        decimals = Number(potentional[1]?.replace(/[+-]/g, '')) + Number(potentional[0].length)
      }

    }
    block.fees = Number.parseFloat(String(block.fees)).toFixed(decimals)

    try {
      await Promise.all(block.transactions
        .map(async transaction => transactionPoolStore.delete(transaction.hash)))


      let blockMessage = await new BlockMessage(block)
      const hash = await blockMessage.hash()
      
      
      await peernet.put(hash, blockMessage.encoded, 'block')
      await this.#updateState(blockMessage)
      debug(`created block: ${hash}`)

      peernet.publish('add-block', blockMessage.encoded)
      pubsub.publish('add-block', blockMessage.decoded)
    } catch (error) {
      console.log(error);
      throw new Error(`invalid block ${block}`)
    }
    // data = await this.#machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  

  async #addTransaction(transaction) {
    try {      
      transaction = await new TransactionMessage(transaction)
      const hash = await transaction.hash()
      const has = await transactionPoolStore.has(hash)
      if (!has) await transactionPoolStore.put(hash, transaction.encoded)
      if (this.#participating && !this.#runningEpoch) this.#runEpoch()
    } catch {
      throw new Error('invalid transaction')
    }
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
    const event = await super.createTransactionFrom(from, to, method, parameters, nonce)
    this.#addTransaction(event.message.encoded)
    return event    
  }

  /**
   * 
   * @param {Address} sender 
   * @returns {globalMessage}
   */
  #createMessage(sender = peernet.selectedAccount) {
    return {
      sender,
      call: this.call,
      staticCall: this.staticCall,
      delegate: this.delegate,
      staticDelegate: this.staticDelegate
    }
  }

  /**
   * 
   * @param {Address} sender 
   * @param {Address} contract 
   * @param {String} method 
   * @param {Array} parameters 
   * @returns 
   */
  internalCall(sender, contract, method, parameters) {
    globalThis.msg = this.#createMessage(sender)

    return this.#machine.execute(contract, method, parameters)
  }

  /**
   * 
   * @param {Address} contract 
   * @param {String} method 
   * @param {Array} parameters 
   * @returns 
   */
  call(contract, method, parameters) {
    globalThis.msg = this.#createMessage()

    return this.#machine.execute(contract, method, parameters)
  }

  staticCall(contract, method, parameters) {
    globalThis.msg = this.#createMessage()
    return this.#machine.get(contract, method, parameters)
  }

  delegate(contract, method, parameters) {
    globalThis.msg = this.#createMessage()

    return this.#machine.execute(contract, method, parameters)
  }

  staticDelegate(contract, method, parameters) {
    globalThis.msg = this.#createMessage()

    return this.#machine.get(contract, method, parameters)
  }

  mint(to, amount) {
    return this.call(addresses.nativeToken, 'mint', [to, amount])
  }

  transfer(from, to, amount) {
    return this.call(addresses.nativeToken, 'transfer', [from, to, amount])
  }

  get balances() {
    return this.staticCall(addresses.nativeToken, 'balances')
  }

  get contracts() {
    return this.staticCall(addresses.contractFactory, 'contracts')
  }

  deleteAll() {
    return this.#machine.deleteAll()
  }

  /**
   * lookup an address for a registered name using the builtin nameService
   * @check nameService
   *
   * @param {String} - contractName
   * @returns {String} - address
   *
   * @example chain.lookup('myCoolContractName') // qmqsfddfdgfg...
   */
  lookup(name) {
    return this.call(addresses.nameService, 'lookup', [name])
  }
}

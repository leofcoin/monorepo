import { BigNumber, formatUnits, parseUnits, formatBytes } from '@leofcoin/utils'
import Machine from './machine.js'
import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import addresses, { nativeToken } from '@leofcoin/addresses'
import { signTransaction } from '@leofcoin/lib'
import { contractFactoryMessage, nativeTokenMessage, validatorsMessage, nameServiceMessage, calculateFee } from '@leofcoin/lib'
import State from './state.js'
import Contract from './contract.js'
import { BigNumberish } from '@ethersproject/bignumber'

globalThis.BigNumber = BigNumber

// check if browser or local
export default class Chain  extends Contract {
  #state;
  #lastResolved: EpochTimeStamp;
  #slotTime = 10000;
  id: string;
  utils: {};
  /** {Address[]} */
  #validators = [];
  /** {Block[]} */
  #blocks = [];

  #blockHashMap = new Map();

  #machine;
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

  #knownBlocks: Address[] = []

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
    const size = await globalThis.transactionPoolStore.size()
    if (size > 0) return true
    return false
  }

  async #runEpoch() {
    this.#runningEpoch = true
    console.log('epoch');
    const validators = await this.staticCall(addresses.validators, 'validators')
    console.log({validators});
    if (!validators[globalThis.globalThis.peernet.selectedAccount]?.active) return
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
      // console.log({message});
      message = await new ContractMessage(Uint8Array.from(message.split(',').map(string => Number(string))))
      await globalThis.contractStore.put(address, message.encoded)
    }))
    console.log('handle native contracts');
    // handle native contracts
  }

  promiseRequests(promises) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve([{index: 0, hash: '0x0'}])
        globalThis.debug('sync timed out')
      }, 10_000)
  
      promises = await Promise.allSettled(promises);
      promises = promises.filter(({status}) => status === 'fulfilled')
      clearTimeout(timeout)

      if (promises.length > 0) {
        promises = promises.map(async ({value}) => {
          const node = await new globalThis.peernet.protos['peernet-response'](value.result)
          return {value: node.decoded.response, peer: value.peer}
        })
        promises = await Promise.all(promises)
        
        resolve(promises)
      } else {
        resolve([])
      }
      
    })
    
  }

  getLatestBlock() {
    return this.#getLatestBlock()
  }

  async #getLatestBlock() {
    let promises = [];
    
    let data = await new globalThis.peernet.protos['peernet-request']({request: 'lastBlock'});
    let node = await globalThis.peernet.prepareMessage(data);

    for (const peer of globalThis.peernet?.connections) {
      if (peer.connected) {        
        promises.push(async () => {
          try {
            const result = await peer.request(node.encoded)
            return {result, peer}
          } catch (error) {
            throw error
          }

        });
      } else if (!peer.connected) {
        globalThis.peernet.removePeer(peer)
        // todo: remove peer
        // reinitiate channel?
      }
    }
    promises = await this.promiseRequests(promises)
    let latest = {index: 0, hash: '0x0', previousHash: '0x0'}



    promises = promises.sort((a, b) => b.index - a.index)

    if (promises.length > 0) latest = promises[0].value
    
    
    if (latest.hash && latest.hash !== '0x0') {
      let message = await globalThis.peernet.get(latest.hash, 'block')
      message = await new BlockMessage(message)
      const hash = await message.hash()
      if (hash !== latest.hash) throw new Error('invalid block @getLatestBlock')
      
      let data = await new globalThis.peernet.protos['peernet-request']({request: 'knownBlocks'});
      let node = await globalThis.peernet.prepareMessage(data);
      const peer = promises[0].peer
      latest = {...message.decoded, hash}
      if (peer.connected && peer.readyState === 'open' && peer.peerId !== this.id) {
        let message = await peer.request(node)
        message = await new globalThis.peernet.protos['peernet-response'](message)
        this.#knownBlocks = message.decoded.response
      }
    }
    return latest
  }

  async #init() {
    // this.node = await new Node()
    this.#participants = []
    this.#participating = false
    const initialized = await globalThis.contractStore.has(addresses.contractFactory)
    if (!initialized) await this.#setup()

   
    this.utils = { BigNumber, formatUnits, parseUnits }

    this.#state = new State()
    

    await globalThis.peernet.addRequestHandler('bw-request-message', () => {

      return new BWMessage(globalThis.peernet.client.bw) || { up: 0, down: 0 }
    })

    // await globalThis.peernet.addRequestHandler('peerId', () => {
    //   let node = 
    //   globalThis.peernet.protos['peernet-response']({response: node.encoded})
    // })

    await globalThis.peernet.addRequestHandler('transactionPool', this.#transactionPoolHandler.bind(this))

    await globalThis.peernet.addRequestHandler('lastBlock', this.#lastBlockHandler.bind(this))
    await globalThis.peernet.addRequestHandler('knownBlocks', this.#knownBlocksHandler.bind(this))

    globalThis.peernet.subscribe('add-block', this.#addBlock.bind(this))

    globalThis.peernet.subscribe('invalid-transaction', this.#invalidTransaction.bind(this))

    globalThis.peernet.subscribe('add-transaction', this.#addTransaction.bind(this))

    globalThis.peernet.subscribe('validator:timeout', this.#validatorTimeout.bind(this))

    globalThis.pubsub.subscribe('peer:connected', this.#peerConnected.bind(this))
    // todo some functions rely on state
    try {
      let localBlock
      try {
        localBlock = await globalThis.chainStore.get('lastBlock')
      } catch{
        await globalThis.chainStore.put('lastBlock', '0x0')
        localBlock = await globalThis.chainStore.get('lastBlock')
      }
      localBlock = new TextDecoder().decode(localBlock)
      if (localBlock && localBlock !== '0x0') {
        localBlock = await globalThis.peernet.get(localBlock, 'block')
        localBlock = await new BlockMessage(localBlock)
        this.#lastBlock = {...localBlock.decoded, hash: await localBlock.hash()}
      } else {
        if (globalThis.peernet?.connections.length > 0) {
          const latestBlock = await this.#getLatestBlock()
          await this.#syncChain(latestBlock)
        }
      }      
    } catch (error) {
      console.log({e: error});
    }

    
    // load local blocks
    await this.resolveBlocks()
    this.#machine = await new Machine(this.#blocks)
    
    await this.#loadBlocks(this.#blocks)
    globalThis.globalThis.pubsub.publish('chain:ready', true)
    return this
  }

  async #invalidTransaction(hash) {
    await globalThis.transactionPoolStore.delete(hash)
    console.log(`removed invalid transaction: ${hash}`);
  }

  async #validatorTimeout(validatorInfo) {
    setTimeout(() => {
      this.#jail.splice(this.#jail.indexOf(validatorInfo.address), 1)
    }, validatorInfo.timeout)
    this.#jail.push(validatorInfo.address)
  }

  async triggerSync() {
    if (this.#chainSyncing) return 'already syncing'
    const latest = await this.#getLatestBlock()
    await this.#syncChain(latest)
    return 'synced'
  }

  async #syncChain(lastBlock) {
    const timeout = () => setTimeout(() => {
      if (this.#chainSyncing) {
        if (this.#lastResolved + 10000 > Date.now()) timeout()
        else {
          this.#chainSyncing = false
          console.log('resyncing');
          
          this.#syncChain(lastBlock)
        }
      }
    }, 10000)

    timeout()
    if (this.#chainSyncing || !lastBlock || !lastBlock.hash || !lastBlock.hash) return
    this.#chainSyncing = true
    if (this.#knownBlocks?.length === Number(lastBlock.index) + 1) {
      let promises = []
      promises = await Promise.allSettled(this.#knownBlocks.map(async (address) => {
        const has = await globalThis.peernet.has(address, 'block')
        return {has, address}
      }))
      promises = promises.filter(({status, value}) => status === 'fulfilled' && !value.has)
  
      await Promise.allSettled(promises.map(({value}) => this.getAndPutBlock(value.address)))
    }

    if (!this.lastBlock || Number(this.lastBlock.index) < Number(lastBlock.index)) {
      
      // TODO: check if valid
      const localIndex = this.lastBlock ? this.lastBlock.index : 0
      const index = lastBlock.index
      await this.resolveBlock(lastBlock.hash)
      let blocksSynced = localIndex > 0 ? (localIndex > index ? localIndex - index : index - localIndex) : index
      globalThis.debug(`synced ${blocksSynced} ${blocksSynced > 1 ? 'blocks' : 'block'}`)

      const start = (this.#blocks.length - blocksSynced) - 1
      if (this.#machine) await this.#loadBlocks(this.blocks.slice(start))
      await this.#updateState(new BlockMessage(this.#blocks[this.#blocks.length - 1]))
    }
    clearTimeout(timeout)
    this.#chainSyncing = false
  }

  async #prepareRequest(request) {
    let node = await new globalThis.peernet.protos['peernet-request']({request})
    return globalThis.peernet.prepareMessage(node)
  }

  async #makeRequest(peer, request: string) {
    const node = await this.#prepareRequest(request)
    let response = await peer.request(node.encoded)
    response = await new globalThis.peernet.protos['peernet-response'](new Uint8Array(Object.values(response)))
    return response.decoded.response
  }

  async #peerConnected(peer) {
    const lastBlock = await this.#makeRequest(peer, 'lastBlock')
    this.#knownBlocks = await this.#makeRequest(peer, 'knownBlocks')
    let pool = await this.#makeRequest(peer, 'transactionPool')
    pool = await Promise.all(pool.map(async (hash) => {
      const has = await globalThis.peernet.has(hash)
      return {has, hash}
    }))

    pool = pool.filter(item => !item.has)
    await Promise.all(pool.map(async ({hash}) => {
      const result = await globalThis.peernet.get(hash)
      const node = await new TransactionMessage(result)
      await globalThis.transactionPoolStore.put(await node.hash(), node.encoded)
    }))
    if (pool.length > 0) this.#runEpoch()
    console.log(pool);
    
    if (lastBlock) this.#syncChain(lastBlock)
 }

 #epochTimeout

async #transactionPoolHandler() {
  const pool = await globalThis.transactionPoolStore.keys()
  return new globalThis.peernet.protos['peernet-response']({response: pool})
}

async #lastBlockHandler() {
  return new globalThis.peernet.protos['peernet-response']({response: { hash: this.#lastBlock?.hash, index: this.#lastBlock?.index }})
}

async #knownBlocksHandler() {
  return new globalThis.peernet.protos['peernet-response']({response: {blocks: this.#blocks.map((block) => block.hash)}})
}

async getAndPutBlock(hash: string): BlockMessage {
  let block = await globalThis.peernet.get(hash, 'block')
  block = await new BlockMessage(block)
  const { index } = block.decoded
  if (this.#blocks[index] && this.#blocks[index].hash !== block.hash) throw `invalid block ${hash} @${index}`
  if (!await globalThis.peernet.has(hash, 'block')) await globalThis.peernet.put(hash, block.encoded, 'block')
  return block
}

async resolveBlock(hash) {
  if (!hash)  throw new Error(`expected hash, got: ${hash}`)
  if (hash === '0x0') return

  const index = this.#blockHashMap.get(hash)
  
  if (this.#blocks[index]) {
    if (this.#blocks[index].previousHash !== '0x0') {
      return this.resolveBlock(this.#blocks[index].previousHash)
    } else {
      return
    }
  }
  try {
    const block = await this.getAndPutBlock(hash)
    const { previousHash, index } = block.decoded
    const size = block.encoded.length > 0 ? block.encoded.length : block.encoded.byteLength
    this.#totalSize += size
    this.#blocks[index] = { hash, ...block.decoded }
    this.#blockHashMap.set(hash, index)
    console.log(`resolved block: ${hash} @${index} ${formatBytes(size)}`);
    this.#lastResolved = Date.now()

    if (previousHash !== '0x0') {
      return this.resolveBlock(previousHash)
    }
  } catch (error) {
    console.error(error)
  }
}

  async resolveBlocks() {
    try {
      const localBlock = await globalThis.chainStore.get('lastBlock')
      const hash = new TextDecoder().decode(localBlock)

      if (hash && hash !== '0x0')
        await this.resolveBlock(hash)
        this.#lastBlock = this.#blocks[this.#blocks.length - 1]
        
    } catch {
      await globalThis.chainStore.put('lastBlock', new TextEncoder().encode('0x0'))
      return this.resolveBlocks()
// console.log(e);
    }
  }

  /**
   * 
   * @param {Block[]} blocks 
   */
  async #loadBlocks(blocks) {
    let poolTransactionKeys = await globalThis.transactionPoolStore.keys()
    for (const block of blocks) {
      if (block && !block.loaded) {
        for (const transaction of block.transactions) {
          if (poolTransactionKeys.includes(transaction.hash)) await globalThis.transactionPoolStore.delete(transaction.hash)
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
        globalThis.debug(`loaded block: ${block.hash} @${block.index}`);
      }
    }
  }

  async #executeTransaction({hash, from, to, method, params, nonce}) {
    try {
      let result = await this.#machine.execute(to, method, params, from, nonce)
      // if (!result) result = this.#machine.state
      globalThis.pubsub.publish(`transaction.completed.${hash}`, {status: 'fulfilled', hash})
      return result || 'no state change'
    } catch (error) {
      console.log({error});
      globalThis.peernet.pubsub.publish('invalid-transaction', hash)
      globalThis.pubsub.publish(`transaction.completed.${hash}`, {status: 'fail', hash, error: error})
      throw {error, hash, from, to, params, nonce}
    }
  }

  async #addBlock(block) {
    const blockMessage = await new BlockMessage(block)
    await Promise.all(blockMessage.decoded.transactions
      .map(async transaction => globalThis.transactionPoolStore.delete(transaction.hash)))
    const hash = await blockMessage.hash()
    
    await globalThis.blockStore.put(hash, blockMessage.encoded)
    
    if (this.lastBlock.index < blockMessage.decoded.index) await this.#updateState(blockMessage)
    globalThis.debug(`added block: ${hash}`)
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
        globalThis.pubsub.publish('transaction-processed', transaction)
        if (transaction.to === globalThis.peernet.selectedAccount) globalThis.pubsub.publish('account-transaction-processed', transaction)        
        await globalThis.accountsStore.put(transaction.from, String(transaction.nonce))
      }
      
      // todo finish state
      // for (const contract of contracts) {
      //   const state = await this.#machine.get(contract, 'state')
      //   // await stateStore.put(contract, state)
      //   console.log(state);
      // }

      
      globalThis.pubsub.publish('block-processed', blockMessage.decoded)
      
    } catch (error) {
      console.log({e: error});
    }

  }

  async #updateState(message) {
    const hash = await message.hash()
    this.#lastBlock = { hash, ...message.decoded }
    
    // await this.state.updateState(message)
    await globalThis.chainStore.put('lastBlock', hash)
  }



  async participate(address) {
    // TODO: validate participant
    // hold min amount of 50k ART for 7 days
    // lock the 50k
    // introduce peer-reputation
    // peerReputation(peerId)
    // {bandwith: {up, down}, uptime}
    this.#participating = true
    if (!await this.staticCall(addresses.validators, 'has', [address])) {
      const rawTransaction = {
        from: address,
        to: addresses.validators,
        method: 'addValidator',
        params: [address],
        nonce: (await this.getNonce(address)) + 1,
        timestamp: Date.now()        
      }      
      
      const transaction = await signTransaction(rawTransaction, globalThis.peernet.identity)
      await this.sendTransaction(transaction)
    }
    if (await this.hasTransactionToHandle() && !this.#runningEpoch) await this.#runEpoch()
  }

  // todo filter tx that need to wait on prev nonce
  async #createBlock(limit = 1800) {
    // vote for transactions
    if (await globalThis.transactionPoolStore.size() === 0) return;

    let transactions = await globalThis.transactionPoolStore.values(this.transactionLimit)
    if (Object.keys(transactions)?.length === 0 ) return
    const keys = await globalThis.transactionPoolStore.keys()

    
    const timestamp = Date.now()

    let block = {
      transactions: [],
      validators: [],
      fees: BigNumber.from(0),
      timestamp,
      previousHash: '',
      reward: parseUnits('150'),
      index: 0
    }

    // exclude failing tx
    transactions = await this.promiseTransactions(transactions)
    transactions = transactions.sort((a, b) => a.nonce - b.nonce)


    for (let transaction of transactions) { 
      const hash = await transaction.hash()
      const doubleTransaction = this.#blocks.filter(({transaction}) => transaction.hash === hash)
      
      if (doubleTransaction.length > 0) {
        await globalThis.transactionPoolStore.delete(hash)
        await globalThis.peernet.publish('invalid-transaction', hash)
      } else {
        if (timestamp + this.#slotTime > Date.now()) {
          try {
            const result = await this.#executeTransaction({...transaction.decoded, hash})
            console.log({result});
            
            block.transactions.push({hash, ...transaction.decoded})
            
            block.fees = block.fees.add(await calculateFee(transaction.decoded))
            await globalThis.accountsStore.put(transaction.decoded.from, new TextEncoder().encode(String(transaction.decoded.nonce)))
          } catch (e) {
            console.log(keys.includes(hash));
            
            console.log({e});
            console.log(hash);
            
            await globalThis.transactionPoolStore.delete(hash)
          }
        }
        
      }
      
    }
    console.log(block.transactions);
    
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
    for (const entry of globalThis.peernet.peerEntries) {
      peers[entry[0]] = entry[1]
    }
    for (const validator of Object.keys(validators)) {
      if (validators[validator].active) {
        const peer = peers[validator]
        if (peer && peer.connected) {
          let data = await new BWRequestMessage()
          const node = await globalThis.peernet.prepareMessage(validator, data.encoded)
          try {
            const bw = await peer.request(node.encoded)
            console.log({bw});
            block.validators.push({
              address: validator,
              bw: bw.up + bw.down
            })
          } catch{}

        } else if (globalThis.peernet.selectedAccount === validator) {
          block.validators.push({
            address: globalThis.peernet.selectedAccount,
            bw: globalThis.peernet.bw.up + globalThis.peernet.bw.down
          })

          }
        }

    }


    console.log({validators: block.validators});

    block.validators = block.validators.map(validator => {

      validator.reward = block.fees
      validator.reward = validator.reward.add(block.reward)
      validator.reward = validator.reward.div(block.validators.length)
      validator.reward = validator.reward.toString()
      delete validator.bw
      return validator
    })

    console.log({validators: block.validators});
    // block.validators = calculateValidatorReward(block.validators, block.fees)

    block.index = this.lastBlock?.index
    if (block.index === undefined) block.index = 0
    else block.index += 1

    block.previousHash = this.lastBlock?.hash || '0x0'
    block.timestamp = Date.now()
    block.reward = block.reward.toString()
    block.fees = block.fees.toString()

    try {
      await Promise.all(block.transactions
        .map(async transaction => globalThis.transactionPoolStore.delete(transaction.hash)))

      let blockMessage = await new BlockMessage(block)
      const hash = await blockMessage.hash()
      
      await globalThis.peernet.put(hash, blockMessage.encoded, 'block')
      await this.#updateState(blockMessage)
      
      globalThis.debug(`created block: ${hash}`)

      globalThis.peernet.publish('add-block', blockMessage.encoded)
      globalThis.pubsub.publish('add-block', blockMessage.decoded)
    } catch (error) {
      throw new Error(`invalid block ${block}`)
    }
    // data = await this.#machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  

  async #addTransaction(transaction) {
    transaction = await new TransactionMessage(transaction)
    const hash = await transaction.hash()
    try {
      const has = await globalThis.transactionPoolStore.has(hash)
      if (!has) {
        await globalThis.transactionPoolStore.put(hash, transaction.encoded)
        if (this.#participating && !this.#runningEpoch) this.#runEpoch()
      }
      else globalThis.peernet.pubsub('invalid-transaction', hash)
    } catch (e) {
      console.log(e);
      globalThis.peernet.pubsub('invalid-transaction', hash)
      throw new Error('invalid transaction')
    }
  }
  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   **/
   async sendTransaction(transaction) {
    const event = await super.sendTransaction(transaction)
    this.#addTransaction(event.message.encoded)
    return event    
  }

  async addContract(transaction, contractMessage) {
    const hash = await contractMessage.hash()
    const has = await this.staticCall(addresses.contractFactory, 'isRegistered', [hash])
    if (has) throw new Error('contract exists')

    const tx = await this.sendTransaction(transaction)
    await tx.wait
    return tx
  }

  /**
   * 
   * @param {Address} sender 
   * @returns {globalMessage}
   */
  #createMessage(sender = globalThis.globalThis.peernet.selectedAccount) {
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

  staticCall(contract, method, parameters?) {
    globalThis.msg = this.#createMessage()
    return this.#machine.get(contract, method, parameters)
  }

  delegate(contract, method, parameters) {
    globalThis.msg = this.#createMessage()

    return this.#machine.execute(contract, method, parameters)
  }

  staticDelegate(contract: Address, method: string, parameters: []): any {
    globalThis.msg = this.#createMessage()

    return this.#machine.get(contract, method, parameters)
  }

  mint(to: string, amount: BigNumberish) {
    return this.call(addresses.nativeToken, 'mint', [to, amount])
  }

  transfer(from: string, to: string, amount: BigNumberish) {
    return this.call(addresses.nativeToken, 'transfer', [from, to, amount])
  }

  get balances(): {address: BigNumberish} {
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
  lookup(name): {owner: string, address: string} {
    return this.call(addresses.nameService, 'lookup', [name])
  }
}

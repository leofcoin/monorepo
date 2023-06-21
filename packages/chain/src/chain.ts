import { BigNumber, formatUnits, parseUnits, formatBytes } from '@leofcoin/utils'
import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import addresses from '@leofcoin/addresses'
import { signTransaction } from '@leofcoin/lib'
import { contractFactoryMessage, nativeTokenMessage, validatorsMessage, nameServiceMessage, calculateFee } from '@leofcoin/lib'
import { BigNumberish } from '@ethersproject/bignumber'
import State from './state.js'

globalThis.BigNumber = BigNumber

const ignorelist = ['BA5XUACBBBAT653LT3GHP2Z5SUHVCA42BP6IBFBJACHOZIHHR4DUPG2XMB', 'BA5XUACK6K5XA5P4BHRZ4SZT6FCLO6GLGCLUAD62WBPVLFK73RHZZUFLEG']

// check if browser or local
export default class Chain extends State {
  #state;
  
  #slotTime = 10000;
  id;
  utils = {};
  /** {Address[]} */
  #validators = [];

  /** {Boolean} */
  #runningEpoch = false



  #participants = []
  #participating = false
  #jail = []

  constructor() {
    super()
    return this.#init()
  }

  get nativeToken() {
    return addresses.nativeToken
  }

  get validators() {
    return [...this.#validators]
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
    if (!validators[peernet.selectedAccount]?.active) return
    const start = Date.now()
    try {
      await this.#createBlock()
    } catch (error) {
      console.error(error);
      console.log('ttttt');
      
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

  async clearPool() {
    await globalThis.transactionPoolStore.clear()
  }

  async #init() {
    try {
      const version = await globalThis.chainStore.get('version')
      
      this.version = new TextDecoder().decode(version)
      
      if (this.version !== '1.0.0') {
        this.version = '1.0.0'
        await globalThis.chainStore.clear()
        await globalThis.blockStore.clear()
        await globalThis.transactionPoolStore.clear()
        await globalThis.chainStore.put('version', this.version)
      }
      // if (version)
    } catch (e) {
      console.log(e);
      
      this.version = '1.0.0'
      await globalThis.chainStore.clear()
      await globalThis.blockStore.clear()
      await globalThis.transactionPoolStore.clear()
      await globalThis.chainStore.put('version', new TextEncoder().encode(this.version))
    }
    
    // this.node = await new Node()
    this.#participants = []
    this.#participating = false
    const initialized = await globalThis.contractStore.has(addresses.contractFactory)
    if (!initialized) await this.#setup()

   
    this.utils = { BigNumber, formatUnits, parseUnits }

    // this.#state = new State()
    

    await globalThis.peernet.addRequestHandler('bw-request-message', () => {

      return new BWMessage(globalThis.peernet.client.bw) || { up: 0, down: 0 }
    })

    // await globalThis.peernet.addRequestHandler('peerId', () => {
    //   let node = 
    //   globalThis.peernet.protos['peernet-response']({response: node.encoded})
    // })

    

    await globalThis.peernet.addRequestHandler('transactionPool', this.#transactionPoolHandler.bind(this))
    await globalThis.peernet.addRequestHandler('version', this.#versionHandler.bind(this))

   

    globalThis.peernet.subscribe('add-block', this.#addBlock.bind(this))

    globalThis.peernet.subscribe('invalid-transaction', this.#invalidTransaction.bind(this))

    globalThis.peernet.subscribe('send-transaction', this.#sendTransaction.bind(this))

    globalThis.peernet.subscribe('add-transaction', this.#addTransaction.bind(this))

    globalThis.peernet.subscribe('validator:timeout', this.#validatorTimeout.bind(this))

    globalThis.pubsub.subscribe('peer:connected', this.#peerConnected.bind(this))
    // todo some functions rely on state
    await super.init()
    
    globalThis.pubsub.publish('chain:ready', true)
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

  #addTransaction(message) {
    console.log(message);
    
  }

  
  async #prepareRequest(request) {
    let node = await new globalThis.peernet.protos['peernet-request']({request})
    return globalThis.peernet.prepareMessage(node)
  }

  async #makeRequest(peer, request) {
    const node = await this.#prepareRequest(request)
    let response = await peer.request(node.encoded)
    response = await new globalThis.peernet.protos['peernet-response'](new Uint8Array(Object.values(response)))
    return response.decoded.response
  }

  async #peerConnected(peer) {
    if (!peer.version || peer.version !== this.version) return

    const lastBlock = await this.#makeRequest(peer, 'lastBlock')

    let transactionsInPool = await this.#makeRequest(peer, 'transactionPool')

    const transactions = await globalThis.transactionPoolStore.keys()
    console.log({transactionsInPool});
    
    const transactionsToGet = []
    for (const key of transactionsInPool) {
      if (!transactions.includes(key) && !ignorelist.includes(key)) transactionsToGet.push(transactionPoolStore.put(key, (await peernet.get(key, 'transaction'))))
    }
    
    console.log(await transactionPoolStore.keys());
    
    await Promise.all(transactionsToGet)
    
    if (Object.keys(lastBlock).length > 0) {
      
      if (!this.lastBlock || !this.blocks[this.blocks.length - 1]?.loaded || lastBlock && lastBlock.index > this.lastBlock?.index || !this.loaded && !this.resolving) {
        this.knownBlocks = await this.#makeRequest(peer, 'knownBlocks')
        
        await this.syncChain(lastBlock)
    
        // if (await this.hasTransactionToHandle() && this.#participating) this.#runEpoch()
      } else if (!this.knownBlocks) this.knownBlocks = await this.#makeRequest(peer, 'knownBlocks')
    }

    if (this.#participating) this.#runEpoch()
 }

 #epochTimeout

async #transactionPoolHandler() {
  const pool = await globalThis.transactionPoolStore.keys()
  return new globalThis.peernet.protos['peernet-response']({response: pool})
}

async #versionHandler() {
  return new globalThis.peernet.protos['peernet-response']({response: {version: this.version}})
}

async #executeTransaction({hash, from, to, method, params, nonce}) {
  try {
    let result = await this.machine.execute(to, method, params)
    
    // if (!result) result = this.machine.state
    globalThis.pubsub.publish(`transaction.completed.${hash}`, {status: 'fulfilled', hash})
    return result || 'no state change'
  } catch (error) {
    
    await transactionPoolStore.delete(hash)
    globalThis.peernet.publish('invalid-transaction', hash)
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
    
    if (this.lastBlock.index < blockMessage.decoded.index) await this.updateState(blockMessage)
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
      //   const state = await this.machine.get(contract, 'state')
      //   // await stateStore.put(contract, state)
      //   console.log(state);
      // }

      
      globalThis.pubsub.publish('block-processed', blockMessage.decoded)
      
    } catch (error) {
      console.log(error.hash);
      console.log('errrrr');
      
      
      await transactionPoolStore.delete(error.hash)
      console.log({e: error});
    }

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
    if (await this.hasTransactionToHandle() && !this.#runningEpoch && this.#participating) await this.#runEpoch()
  }

  // todo filter tx that need to wait on prev nonce
  async #createBlock(limit = 1800) {
    
    // vote for transactions
    if (await globalThis.transactionPoolStore.size() === 0) return;

    let transactions = await globalThis.transactionPoolStore.values(this.transactionLimit)
    for (const hash of await globalThis.transactionPoolStore.keys()) {
      if (ignorelist.includes(hash)) await globalThis.transactionPoolStore.delete(hash)
    }
    
    
    if (Object.keys(transactions)?.length === 0 ) return
    
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
    console.log({transactions});
    

    for (let transaction of transactions) { 
      const hash = await transaction.hash()
      const doubleTransactions = []

      console.log(this.blocks);
      
      for (const block of this.blocks) {
        for (const transaction of block.transactions) {
          if (transaction.hash === hash) {
            doubleTransactions.push(hash)
          }
        }
      }
      
      if (doubleTransactions.length > 0) {
        await globalThis.transactionPoolStore.delete(hash)
        await globalThis.peernet.publish('invalid-transaction', hash)
        return
      }
      
      
        // if (timestamp + this.#slotTime > Date.now()) {
      try {
        const result = await this.#executeTransaction({...transaction.decoded, hash})
        console.log({result});
        
        block.transactions.push(transaction)
        
        block.fees = block.fees.add(await calculateFee(transaction.decoded))
        await globalThis.accountsStore.put(transaction.decoded.from, new TextEncoder().encode(String(transaction.decoded.nonce)))
      } catch (e) {
        console.log('vvvvvv');
        
        console.log({e});
        console.log(hash);
        peernet.publish('invalid-transaction', hash)

        console.log(await globalThis.transactionPoolStore.keys());
        
        console.log(await globalThis.transactionPoolStore.has(e.hash));
        
        await globalThis.transactionPoolStore.delete(e.hash)

        console.log(await globalThis.transactionPoolStore.has(e.hash));
        
      }
      
    }
    
    // don't add empty block
    if (block.transactions.length === 0) return

    const validators = await this.staticCall(addresses.validators, 'validators')
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
        if (peer && peer.connected && peer.version === this.version) {
          let data = await new BWRequestMessage()
          const node = await globalThis.peernet.prepareMessage(validator, data.encoded)
          try {
            const bw = await peer.request(node.encoded)
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

    block.validators = block.validators.map(validator => {

      validator.reward = block.fees
      validator.reward = validator.reward.add(block.reward)
      validator.reward = validator.reward.div(block.validators.length)
      delete validator.bw
      return validator
    })
    // block.validators = calculateValidatorReward(block.validators, block.fees)

    block.index = this.lastBlock?.index
    if (block.index === undefined) block.index = 0
    else block.index += 1

    block.previousHash = this.lastBlock?.hash || '0x0'
    // block.timestamp = Date.now()
    // block.reward = block.reward.toString()
    // block.fees = block.fees.toString()

    try {
      block.transactions = await Promise.all(block.transactions
        .map(async transaction => {
          await globalThis.transactionPoolStore.delete(await transaction.hash())
          return transaction.decoded
        }))
      
      let blockMessage = await new BlockMessage(block)
      
      const hash = await blockMessage.hash()
      
      await globalThis.peernet.put(hash, blockMessage.encoded, 'block')
      await this.updateState(blockMessage)
      
      globalThis.debug(`created block: ${hash}`)

      globalThis.peernet.publish('add-block', blockMessage.encoded)
      globalThis.pubsub.publish('add-block', blockMessage.decoded)
    } catch (error) {
      console.log(error);
      console.log('eeeee');
      
      throw new Error(`invalid block ${block}`)
    }
    // data = await this.machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  

  async #sendTransaction(transaction) {
    transaction = await new TransactionMessage(transaction.encoded)
    const hash = await transaction.hash()

    try {
      const has = await globalThis.transactionPoolStore.has(hash)
      
      if (!has) {
        await globalThis.transactionPoolStore.put(hash, transaction.encoded)
        
      }
      if (this.#participating && !this.#runningEpoch) this.#runEpoch()
    } catch (e) {
      console.log(e);
      console.log('rrrrr');
      
      globalThis.peernet.publish('invalid-transaction', hash)
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
    
    this.#sendTransaction(await new TransactionMessage(event.message.encoded))
    globalThis.peernet.publish('send-transaction', event.message.encoded)
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
  #createMessage(sender = globalThis.peernet.selectedAccount) {
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

    return this.machine.execute(contract, method, parameters)
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

    return this.machine.execute(contract, method, parameters)
  }

  staticCall(contract, method, parameters) {
    globalThis.msg = this.#createMessage()
    return this.machine.get(contract, method, parameters)
  }

  delegate(contract, method, parameters) {
    globalThis.msg = this.#createMessage()

    return this.machine.execute(contract, method, parameters)
  }

  staticDelegate(contract: Address, method: string, parameters: []): any {
    globalThis.msg = this.#createMessage()

    return this.machine.get(contract, method, parameters)
  }

  mint(to: string, amount: BigNumberish) {
    return this.call(addresses.nativeToken, 'mint', [to, amount])
  }

  transfer(from: string, to: string, amount: BigNumberish) {
    return this.call(addresses.nativeToken, 'transfer', [from, to, amount])
  }

  get balances():Promise<{address: BigNumberish}[]> {
    return this.staticCall(addresses.nativeToken, 'balances')
  }

  get contracts() {
    return this.staticCall(addresses.contractFactory, 'contracts')
  }

  deleteAll() {
    return this.machine.deleteAll()
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
  lookup(name): Promise<{owner: string, address: string}> {
    return this.call(addresses.nameService, 'lookup', [name])
  }
}

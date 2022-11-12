import { BigNumber, formatUnits, parseUnits } from '@leofcoin/utils'
import Machine from './machine.js'
import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from './../../messages/src/messages'
import addresses from './../../addresses/src/addresses'
import { createContractMessage, contractFactoryMessage, nativeTokenMessage, validatorsMessage, nameServiceMessage, calculateFee } from './../../lib/src/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import {CodecHash} from '@leofcoin/codec-format-interface/dist/index'
import bs32 from '@vandeurenglenn/base32'
import { formatBytes } from '../../utils/src/utils.js'

globalThis.BigNumber = BigNumber

// check if browser or local
export default class Chain {
  #validators = []
  #blocks = []
  #machine
  #runningEpoch = false
  #lastBlock = {index: 0, hash: '0x0', previousHash: '0x0'}

  #jail = []

  constructor() {
    return this.#init()
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
    if (!validators[peernet.id]?.active) return

    const start = new Date().getTime()
    try {
      await this.#createBlock()
    } catch (e) {
      console.error(e);
    }
    
    const end = new Date().getTime()
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
      }, 10000)
  
      promises = await Promise.allSettled(promises);
      promises = promises.filter(({status}) => status === 'fulfilled')
      clearTimeout(timeout)

      promises = promises.map(({value}) => new peernet.protos['peernet-response'](value))
      promises = await Promise.all(promises)
      promises = promises.map(node => node.decoded.response)      
      resolve(promises)
    })
    
  }

  sync() {
    return this.#sync()
  }

  async #sync() {
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
    promises = promises.reduce((set, value) => {
      
      if (value.index > set.index) {
        set.index = value.index;
        set.hash = value.hash;
      }
      return set
    }, {index: 0, hash: '0x0'});
    // get lastblock
      if (promises.hash && promises.hash !== '0x0') {
        let localBlock = await peernet.get(promises.hash)
        console.log({localBlock});
      }
      
      
  }

  async #init() {
    // this.node = await new Node()
    this.participants = []
    this.participating = false
    const initialized = await contractStore.has(addresses.contractFactory)
    if (!initialized) await this.#setup()

    this.#machine = await new Machine()
    this.utils = { BigNumber, formatUnits, parseUnits }

    await peernet.addRequestHandler('bw-request-message', () => {

      return new BWMessage(peernet.client.bw) || { up: 0, down: 0 }
    })

    await peernet.addRequestHandler('lastBlock', this.#lastBlockHandler.bind(this))

    peernet.subscribe('add-block', this.#addBlock.bind(this))

    peernet.subscribe('add-transaction', this.#addTransaction.bind(this))

    peernet.subscribe('validator:timeout', this.#validatorTimeout.bind(this))

    pubsub.subscribe('peer:connected', this.#peerConnected.bind(this))

    try {
      let localBlock
      try {
        localBlock = await chainStore.get('lastBlock')
      } catch(e) {
        await chainStore.put('lastBlock', '0x0')
        localBlock = await chainStore.get('lastBlock')
      }
      localBlock = new TextDecoder().decode(localBlock)

      if (localBlock && localBlock !== '0x0') {
        localBlock = await peernet.get(localBlock)
        localBlock = await new BlockMessage(localBlock)
        this.#lastBlock = {...localBlock.decoded, hash: await localBlock.hash}
      } else if (this.#machine.lastBlock?.hash) {
        // todo remove when network is running
        // recovering chain (not needed if multiple peers are online)
        this.#lastBlock = this.#machine.lastBlock
        await chainStore.put('lastBlock', this.#lastBlock.hash)
      } else  {
        await this.#sync()
      }      
    } catch (e) {
      console.log({e});     
      

      // this.#setup()
    }
    // load local blocks
    if (peernet.connections?.length > 1) await this.resolveBlocks()
    return this
  }

  async #validatorTimeout(validatorInfo) {
    setTimeout(() => {
      this.#jail.splice(this.jail.indexOf(validatorInfo.address), 1)
    }, validatorInfo.timeout)
    this.#jail.push(validatorInfo.address)
  }

  async #peerConnected(peer) {
    let node = await new peernet.protos['peernet-request']({request: 'lastBlock'})
    node = await peernet.prepareMessage(node)
    let response = await peer.request(node.encoded)
    response = await new globalThis.peernet.protos['peernet-response'](response)
    let lastBlock = response.decoded.response

    if (!this.lastBlock || Number(this.lastBlock.index) < Number(lastBlock.index)) {
         // TODO: check if valid
      const localIndex = this.lastBlock ? this.lastBlock.index : 0
      const index = lastBlock.index
      await this.resolveBlock(lastBlock.hash)
      let blocksSynced = localIndex > 0 ? localIndex > index ? localIndex - index : index - localIndex : index
      debug(`synced ${blocksSynced} ${blocksSynced > 1 ? 'blocks' : 'block'}`)

      const end = this.#blocks.length
      const start = (this.#blocks.length) - blocksSynced
      await this.#loadBlocks(this.#blocks)
      this.#lastBlock = this.#blocks[this.#blocks.length - 1]
      const message = await new BlockMessage(this.lastBlock)
      await blockStore.put(await message.hash, message.encoded)
      await chainStore.put('lastBlock', this.lastBlock.hash)
    }
 }

 #epochTimeout

 async #addTransaction(transaction) {
  try {
    transaction = await new TransactionMessage(transaction)
    const has = await transactionPoolStore.has(await transaction.hash)
    if (!has) await transactionPoolStore.put(await transaction.hash, transaction.encoded)
    if (this.participating && !this.#runningEpoch) this.#runEpoch()
  } catch (e) {
    throw Error('invalid transaction')
  }
}

async #lastBlockHandler() {
  return new peernet.protos['peernet-response']({response: { hash: this.#lastBlock?.hash, index: this.#lastBlock?.index }})
}

async resolveBlock(hash) {
  if (!hash)  throw new Error(`expected hash, got: ${hash}`)
  let block = await peernet.get(hash, 'block')
  block = await new BlockMessage(block)
  if (!await peernet.has(hash, 'block')) await peernet.put(hash, block.encoded, 'block')
  const size = block.encoded.length || block.encoded.byteLength
  block = {...block.decoded, hash}
  this.#blocks[block.index - 1] = block
  console.log(`loaded block: ${hash} @${block.index} ${formatBytes(size)}`);
  if (block.previousHash !== '0x0') {
    return this.resolveBlock(block.previousHash)
  }
}

  async resolveBlocks() {
    try {

      const localBlock = await chainStore.get('lastBlock')
      const hash = new TextDecoder().decode(localBlock)
      if (hash && hash !== '0x0')
        await this.resolveBlock(localBlock)
        this.#lastBlock = this.#blocks[this.#blocks.length - 1]
        await this.#loadBlocks(this.#blocks)
    } catch (e) {
      await chainStore.put('lastBlock', new TextEncoder().encode('0x0'))
      return this.resolveBlocks()
// console.log(e);
    }
  }

  async #loadBlocks(blocks) {
    for (const block of blocks) {
      if (block && !block.loaded) {
        for (const transaction of block.transactions) {
          try {
            await this.#machine.execute(transaction.to, transaction.method, transaction.params)

          } catch (e) {
  console.log(e);
          }
        }
        block.loaded = true
        // let message = await peernet.get(block.hash, 'block')

        // const compressed = pako.deflate(message);
        // const result = pako.inflate(compressed);
        // console.log(result.length, compressed.length);
        //
        // console.log(result.length - compressed.length);

        // message = new BlockMessage(message)
  //       for (const transaction of message.decoded.transactions) {
  //         try {
  //           await this.#machine.execute(transaction.to, transaction.method, transaction.params)
  //
  //         } catch (e) {
  // // console.log(e);
  //         }
  //       }
        // block.loaded = true
      }
    }
  }

  async #executeTransaction({hash, from, to, method, params, nonce}) {
    try {
      let result = await this.#machine.execute(to, method, params, from, nonce)
      // if (!result) result = this.#machine.state
      pubsub.publish(`transaction.completed.${hash}`, {status: 'fulfilled', hash})
      return result ? result : 'no state change'
    } catch (e) {
      pubsub.publish(`transaction.completed.${hash}`, {status: 'fail', hash, error: e})
      throw e
    }
  }

  async #addBlock(block) {
    console.log(block);
    const blockMessage = await new BlockMessage(new Uint8Array(Object.values(block)))
    // if (!Buffer.isBuffer(block)) block = Buffer.from(block, 'hex')
    // const transactionJob = async transaction => {
    //   try {
    //     transaction = await transactionPoolStore.get(transaction)
    //   } catch (e) {
    //     try {
    //       transaction = await peernet.get(transaction, 'transaction')
    //     } catch (e) {
    //       console.warn(`couldn't resolve ${transaction}`);
    //     }
    //   }
    //   transaction = new TransactionMessage(transaction)
    //   return transaction
    // }

    console.log(blockMessage);
    const deletions = await Promise.all(blockMessage.decoded.transactions
      .map(async transaction => transactionPoolStore.delete(await transaction.hash)))
    const hash = await blockMessage.hash
    // let transactions = blockMessage.decoded.transactions.map(tx => transactionJob(tx))
    // transactions = await Promise.all(transactions)
    
    await blockStore.put(hash, blockMessage.encoded)
    
    if (this.lastBlock.index < blockMessage.decoded.index) this.#updateState(blockMessage)
    debug(`added block: ${hash}`)
    let promises = []
    let contracts = []
    for (let transaction of blockMessage.decoded.transactions) {
      // await transactionStore.put(transaction.hash, transaction.encoded)
      const index = contracts.indexOf(transaction.to)
      if (index === -1) contracts.push(transaction.to)
      promises.push(this.#executeTransaction(transaction))
    }
    try {
      promises = await Promise.allSettled(promises)
      for (let transaction of blockMessage.decoded.transactions) {
        await accountsStore.put(transaction.from, String(transaction.nonce))
      }
      
      // todo finish state
      // for (const contract of contracts) {
      //   const state = await this.#machine.get(contract, 'state')
      //   // await stateStore.put(contract, state)
      //   console.log(state);
      // }

      
      pubsub.publish('block-processed', blockMessage.decoded)
    } catch (e) {
      console.log({e});
    }

  }

  async #updateState(message) {
    const hash = await message.hash
    this.#lastBlock = { hash, ...message.decoded }
    await chainStore.put('lastBlock', hash)
  }



  async participate() {
    // TODO: validate participant
    // hold min amount of 50k ART for 7 days
    // lock the 50k
    // introduce peer-reputation
    // peerReputation(peerId)
    // {bandwith: {up, down}, uptime}
    this.participating = true
    if (!await this.staticCall(addresses.validators, 'has', [peernet.id])) await this.createTransactionFrom(peernet.id, addresses.validators, 'addValidator', [peernet.id])
    if (await this.hasTransactionToHandle() && !this.#runningEpoch) await this.#runEpoch()
    
    // const runEpoch = () => setTimeout(async () => {
    //   if (await this.hasTransactionToHandle() && !this.#runningEpoch) await this.#runEpoch()
    //   runEpoch()
    // }, 5000)
    // runEpoch()
  }

  calculateFee(transaction) {
    // excluded from fees
    // if (transaction.decoded.to === addresses.validators) return 0
    // fee per gb
    return (transaction.encoded.length / 1024) / 1e-6
  }

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

  // todo filter tx that need to wait on prev nonce
  async #createBlock(limit = 1800) {
    // vote for transactions
    if (await transactionPoolStore.size() === 0) return;

    let transactions = await transactionPoolStore.values(limit)

    if (Object.keys(transactions)?.length === 0 ) return
    
    let block = {
      transactions: [],
      validators: [],
      fees: 0
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
      } catch (e) {
        transaction = await new TransactionMessage(transaction)
        await transactionPoolStore.delete(await transaction.hash)
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
            console.log(bw);
            block.validators.push({
              address: validator,
              bw: bw.up + bw.down
            })
          } catch(e) {

          }

        } else if (peernet.id === validator) {
          block.validators.push({
            address: peernet.id,
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
      await Promise.all(block.transactions
        .map(async transaction => transactionPoolStore.delete(await transaction.hash)))


      let blockMessage = await new BlockMessage(block)
      const hash = await blockMessage.hash
      
      
      await blockStore.put(hash, blockMessage.encoded)
      this.#updateState(blockMessage)
      debug(`created block: ${hash}`)

      peernet.publish('add-block', blockMessage.encoded)
    } catch (e) {
      console.log(e);
      throw Error(`invalid block ${block}`)
    }
    // data = await this.#machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  async promiseTransactions(transactions) {
    transactions = await Promise.all(transactions.map(tx => new TransactionMessage(tx)))
    return transactions
  }

  async promiseTransactionsContent(transactions) {
    transactions = await Promise.all(transactions.map(tx => new Promise(async (resolve, reject) => {
      resolve({ ...tx.decoded, hash: await tx.hash })
    })))

    return transactions
  }

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

  async getNonce(address) {
    if (!await accountsStore.has(address)) {
      const nonce = await this.#getNonceFallback(address)
      await accountsStore.put(address, new TextEncoder().encode(String(nonce)))
    }
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
  async createTransaction(to, method, params, nonce, signature) {
    return this.createTransactionFrom(peernet.id, to, method, params, nonce)
  }

  

/**
 * 
 * @param {Object} transaction {}
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
 * @params {object} transaction -
 * @params {object} wallet - any wallet/signer that supports sign(RAWtransaction)
 */
async #signTransaction (transaction, wallet) {
  return wallet.sign(await this.createTransactionHash(transaction))
}

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
   * @param {Object} transaction
   * @param {Address} transaction.from
   * @param {Address} transaction.to
   * @param {String} transaction.method
   * @param {Array} transaction.params
   * @param {Number} transaction.nonce
   * 
   * @returns {Object} transaction
   */
  async createRawTransaction(transaction) {
    if (!transaction.from) transaction.from = peernet.id
    transaction.timestamp = Date.now()

    if (transaction.nonce === undefined) {
      transaction.nonce = await this.getNonce(transaction.from)
    } else {
      let nonce = await accountsStore.get(transaction.from)
      nonce = new TextDecoder().decode(nonce)
      if (transaction.nonce < nonce) throw Error(`a transaction with a higher nonce already exists`)
      if (transaction.nonce === nonce) throw Error(`a transaction with the same nonce already exists`)
    }
    return transaction
  }
  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   *
   * @param {String} from - the sender address
   * @param {String} to - the contract address for the contract to interact with
   * @param {String} method - the method/function to run
   * @param {Array} params - array of paramters to apply to the contract method
   * @param {Number} nonce - total transaction count [optional]
   */
  async createTransactionFrom(from, to, method, params, nonce) {
    try {
      
      const rawTransaction = await this.createRawTransaction({from, to, nonce, method, params})    
      const transaction = await this.signTransaction(rawTransaction, from)
      const message = await new TransactionMessage(transaction)

      let data
      // await transactionPoolStore.put(message.hash, new TextEncoder().encode(JSON.stringify({signature, message: message.encoded})))
      const wait = () => new Promise(async (resolve, reject) => {
        if (pubsub.subscribers[`transaction.completed.${await message.hash}`]) {
          const result = pubsub.subscribers[`transaction.completed.${await message.hash}`].value
          result.status === 'fulfilled' ? resolve(await result.hash) : reject({hash: await result.hash, error: result.error})
        } else {
          const completed = async result => {
            result.status === 'fulfilled' ? resolve(await result.hash) : reject({hash: await result.hash, error: result.error})
    
            setTimeout(async () => {
              pubsub.unsubscribe(`transaction.completed.${await message.hash}`, completed)
            }, 10000)
          }
          pubsub.subscribe(`transaction.completed.${await message.hash}`, completed)
        }
        
        
      })
      
      await transactionPoolStore.put(await message.hash, message.encoded)
      peernet.publish('add-transaction', message.encoded)
      this.#addTransaction(message.encoded)
      return {hash: await message.hash, data, fee: await calculateFee(message.decoded), wait}
    } catch (e) {
      console.log(e)
      throw e
    }
    
  }

  async createContractMessage(creator, contract, constructorParameters = []) {
    return createContractMessage(creator, contract, constructorParameters = [])
  }

  async createContractAddress(creator, contract, constructorParameters = []) {
    contract = await this.createContractMessage(creator, contract, constructorParameters)
    return contract.hash
  }

  /**
   *
   * @param {String} contract - a contract string (see plugins/deployContract)
   */
  async deployContract(contract, params = []) {
    globalThis.msg = {sender: peernet.id, call: this.call}

    const hash = await this.createContractAddress(creator, contract, params)
console.log(hash);
    try {
      const tx = await this.createTransactionFrom(peernet.id, addresses.contractFactory, 'deployContract', [hash, creator, contract, constructorParameters])
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
    return this.call(addresses.nativeToken, 'mint', [to, amount])
  }

  transfer(from, to, amount) {
    return this.call(addresses.nativeToken, 'transfer', [from, to, amount])
  }

  get balances() {
    return this.staticCall(addresses.nativeToken, 'balances')
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

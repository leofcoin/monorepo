import PQueue from 'p-queue';
import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import { formatBytes } from '@leofcoin/utils'
import Contract from './contract.js';
import Machine from './machine.js';
import { nativeToken } from '@leofcoin/addresses'
import Jobber from './jobs/jobber.js';
import { Address, BlockHash, BlockInMemory, LoadedBlock, RawBlock } from './types.js';

declare type SyncState = 'syncing' | 'synced' | 'errored' | 'connectionless'

const queue = new PQueue({concurrency: 1, throwOnTimeout: true});

export default class State extends Contract {
  #resolveErrored: boolean;
  #lastResolvedTime: EpochTimeStamp;
  #lastResolved: {index: 0, hash: '0x0', previousHash: '0x0'};
  #resolving: boolean = false;
  #resolveErrorCount: number = 0;
  #syncState: SyncState;
  #lastBlockInQue: { index: 0, hash: '0x0'} | undefined;
  #syncErrorCount = 0;
  #blockHashMap = new Map();
  #chainSyncing: boolean = false;
  #lastBlock = {index: 0, hash: '0x0', previousHash: '0x0'};
  #blocks = [];
  knownBlocks: BlockHash[] = []
  #totalSize: number = 0;
  #machine: Machine;

  #loaded: boolean = false

  get blockHashMap() {
    return this.#blockHashMap.entries()
  }

  get loaded() {
    return this.#loaded
  }

  get resolving() {
    return this.#resolving
  }

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

  get blocks() {
    return [...this.#blocks]
  }

  get lastBlock() {
    return this.#lastBlock
  }

  get totalSize() {
    return this.#totalSize
  }

  get machine() {
    return this.#machine
  }
  
  constructor() {
    super()
  }

  async init() {
    this.jobber = new Jobber(30_000)
    if (super.init) await super.init()
    await globalThis.peernet.addRequestHandler('lastBlock', this.#lastBlockHandler.bind(this))
    await globalThis.peernet.addRequestHandler('knownBlocks', this.#knownBlocksHandler.bind(this))

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
      
      console.log({e: error});
    }
    globalThis.pubsub.publish('lastBlock', this.lastBlock)
    // load local blocks
    try {
      this.knownBlocks = await blockStore.keys()
      
    } catch (error) {
      console.error(error);
      throw error
    }

    await this.resolveBlocks()
    
    this.#machine = await new Machine(this.#blocks)
    
    await this.#loadBlocks(this.#blocks)
  }

  async updateState(message) {
    const hash = await message.hash()
    this.#lastBlock = { hash, ...message.decoded }
    
    // await this.state.updateState(message)
    await globalThis.chainStore.put('lastBlock', hash)
  }

  async #lastBlockHandler() {
    return new globalThis.peernet.protos['peernet-response']({response: { hash: this.#lastBlock?.hash, index: this.#lastBlock?.index }})
  }
  
  async #knownBlocksHandler() {
    return new globalThis.peernet.protos['peernet-response']({response: {blocks: this.#blocks.map((block) => block.hash)}})
  }

  

  getLatestBlock(): Promise<BlockMessage.decoded> {
    return this.#getLatestBlock()
  }

  async getAndPutBlock(hash: string): BlockMessage {
    // todo peernet resolves undefined blocks....
    let block = await globalThis.peernet.get(hash, 'block')
    if (block !== undefined) {
      block = await new BlockMessage(block)
      const { index } = block.decoded
      if (this.#blocks[index - 1] && this.#blocks[index - 1].hash !== block.hash) throw `invalid block ${hash} @${index}`
      if (!await globalThis.peernet.has(hash, 'block')) await globalThis.peernet.put(hash, block.encoded, 'block')
    }
    return block
  }

  async #resolveBlock(hash) {
    let index = this.#blockHashMap.get(hash)
    
    if (this.#blocks[index - 1]) {
      if (this.#blocks[index - 1].previousHash !== '0x0') {
        return this.resolveBlock(this.#blocks[index - 1].previousHash)
      } else {
        return
      }
    }
    try {
      const block = await this.getAndPutBlock(hash)
      index = block.decoded.index
      const size = block.encoded.length > 0 ? block.encoded.length : block.encoded.byteLength
      this.#totalSize += size
      this.#blocks[index - 1] = { hash, ...block.decoded }
      this.#blockHashMap.set(hash, index)
      globalThis.debug(`resolved block: ${hash} @${index} ${formatBytes(size)}`);
      globalThis.pubsub.publish('block-resolved', {hash, index})
      this.#lastResolved = this.#blocks[index - 1]
      this.#lastResolvedTime = Date.now()
    } catch (error) {
      this.#resolving = false
      this.#chainSyncing = false
      throw new Error('resolve error')
    }
    return
  }

  async resolveBlock(hash) {
    if (this.#resolveErrorCount === 3) this.#resolveErrorCount = 0
    if (!hash) throw new Error(`expected hash, got: ${hash}`)
    if (hash === '0x0') return
    if (this.#resolving) return 'already resolving'
    this.#resolving = true
    try {
      await this.jobber.add(() => this.#resolveBlock(hash))
      this.#resolving = false
    
      if (!this.#blockHashMap.has(this.#lastResolved.previousHash) && this.#lastResolved.previousHash !== '0x0') return this.resolveBlock(this.#lastResolved.previousHash)
    } catch (error) {
      this.#resolveErrorCount += 1
      if (this.#resolveErrorCount < 3) return this.resolveBlock(hash)
      else throw new Error('resolve errored')
      
    }
  }
  
    async resolveBlocks() {

     try {
      if (this.jobber.busy && this.jobber.stop) {
        await this.jobber.stop()
      }
     } catch (error) {
      console.error(error)
     }

      try {
        const localBlock = await globalThis.chainStore.get('lastBlock')
        const hash = new TextDecoder().decode(localBlock)
  
        if (hash && hash !== '0x0') {
          
          await this.resolveBlock(hash)
          this.#lastBlock = this.#blocks[this.#blocks.length - 1]
        }
        
          
      } catch {
        this.#resolveErrored = true
        this.#resolveErrorCount += 1
        this.#resolving = false
  // console.log(e);
      }
    }

  async syncChain(lastBlock?): Promise<SyncState > {

    if (!this.shouldSync) {
      return
    }
    try {
      if (this.jobber.busy && this.jobber.stop) {
        await this.jobber.stop()
      }
     } catch (error) {
      console.error(error)
     }
    // await queue.clear()
    this.#chainSyncing = true

    if (!lastBlock) lastBlock = await this.#getLatestBlock()

    console.log('starting sync');
    
    if (globalThis.peernet.connections.length === 0) return 'connectionless'

    try {
      await this.#syncChain(lastBlock)
      
    } catch (error) {
      this.#syncErrorCount += 1
      if (this.#syncErrorCount < 3) await this.#syncChain(lastBlock)
      this.#chainSyncing = false
      this.#syncErrorCount = 0
      return 'errored'
    }
    if (lastBlock.index === this.#lastBlockInQue?.index ) this.#lastBlockInQue = undefined
    this.#syncErrorCount = 0
    this.#chainSyncing = false
    if (this.#lastBlockInQue) return this.syncChain(this.#lastBlockInQue)
    
    return 'synced'
  }

  async #syncChain(lastBlock) {
    try {
      if (this.knownBlocks?.length === Number(lastBlock.index) + 1) {
        let promises = []
        promises = await Promise.allSettled(this.knownBlocks.map(async (address) => {
          const has = await globalThis.peernet.has(address, 'block')
          return {has, address}
        }))
        promises = promises.filter(({status, value}) => status === 'fulfilled' && !value.has)
    
        await Promise.allSettled(promises.map(({value}) => this.getAndPutBlock(value.address)))
      }
  
      if (!this.#lastBlock || Number(this.#lastBlock.index) < Number(lastBlock.index)) {
        
        // TODO: check if valid
        const localIndex = this.#lastBlock ? this.lastBlock.index : 0
        const index = lastBlock.index
        await this.resolveBlock(lastBlock.hash)
        console.log('ok');
        
        let blocksSynced = localIndex > 0 ? (localIndex > index ? localIndex - index : index + - localIndex) : index
        globalThis.debug(`synced ${blocksSynced} ${blocksSynced > 1 ? 'blocks' : 'block'}`)
        
        const start = (this.#blocks.length - blocksSynced)
        if (this.#machine) await this.#loadBlocks(this.blocks.slice(start))
        await this.updateState(new BlockMessage(this.#blocks[this.#blocks.length - 1]))
      }
    } catch (error) {
      console.log(error);
      
      throw error
    }
  }

  async #getLatestBlock() {
    let promises = [];
    
    let data = await new globalThis.peernet.protos['peernet-request']({request: 'lastBlock'});
    let node = await globalThis.peernet.prepareMessage(data);

    for (const peer of globalThis.peernet?.connections) {
      if (peer.connected && peer.version === this.version) {       
        const task = async () => {
          try {
            const result = await peer.request(node.encoded)
            return {result: Uint8Array.from(Object.values(result)), peer}
          } catch (error) {
            throw error
          }

        }
        promises.push(task());
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
      
      latest = {...message.decoded, hash}
      
      const peer = promises[0].peer

      if (peer.connected && peer.version === this.version) {
        let data = await new globalThis.peernet.protos['peernet-request']({request: 'knownBlocks'});
        let node = await globalThis.peernet.prepareMessage(data);
      
        let message = await peer.request(node)
        message = await new globalThis.peernet.protos['peernet-response'](message)
        this.knownBlocks = message.decoded.response
      }
    }
    return latest
  }

  #loadBlockTransactions = (transactions): Promise<TransactionMessage[]> =>
    Promise.all(transactions.map((transaction) => new TransactionMessage(transaction)))

  #getLastTransactions = async () => {
    let lastTransactions = (await Promise.all(this.#blocks.filter(block => block.loaded).slice(-128)
      .map(block => this.#loadBlockTransactions(block.transactions))))
      .reduce((all, transactions) => [...all, ...transactions], [])

    return Promise.all(lastTransactions.map(transaction => transaction.hash()))
  }
  /**
   * 
   * @param {Block[]} blocks 
   */
  async #loadBlocks(blocks: BlockInMemory[]): Promise<boolean> {
    let poolTransactionKeys = await globalThis.transactionPoolStore.keys()

    for (const block of blocks) {
      if (block && !block.loaded) {
        if (block.index === 0) this.#loaded = true
        
        const transactions = await this.#loadBlockTransactions([...block.transactions] || [])

        for (const transaction of transactions) {
          const lastTransactions = await this.#getLastTransactions()
          const hash = await transaction.hash()
          
          if (poolTransactionKeys.includes(hash)) await globalThis.transactionPoolStore.delete(hash)
          if (lastTransactions.includes(hash)) {
            console.log('removing invalid block');
            await globalThis.blockStore.delete(await (await new BlockMessage(block)).hash())
            blocks.splice(block.index - 1)
            return this.#loadBlocks(blocks)
          }
          
          try {
            await this.#machine.execute(transaction.decoded.to, transaction.decoded.method, transaction.decoded.params)
            if (transaction.decoded.to === nativeToken) {
              this.#nativeCalls += 1
              if (transaction.decoded.method === 'burn') this.#nativeBurns += 1
              if (transaction.decoded.method === 'mint') this.#nativeMints += 1
              if (transaction.decoded.method === 'transfer') this.#nativeTransfers += 1
            }
            this.#totalTransactions += 1
          } catch (error) {
            console.log(error);
            
            await globalThis.transactionPoolStore.delete(hash)
            console.log('removing invalid transaction');
            
            console.log(error);
            return false
          }
        }
        this.#blocks[block.index - 1].loaded = true
        
        globalThis.debug(`loaded block: ${block.hash} @${block.index}`);
        globalThis.pubsub.publish('block-loaded', {...block})
      }
    }
    return true
  }

  
  promiseRequests(promises) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve([{index: 0, hash: '0x0'}])
        globalThis.debug('sync timed out')
      }, this.requestTimeout)
  
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

  get canSync() {
    if (this.#chainSyncing) return false
    return true
   }

  get shouldSync() {
    if (this.canSync ||
        this.#resolveErrored ||
        !this.canSync && this.#lastResolvedTime + this.resolveTimeout > new Date().getTime()
       ) return true 
    
    return false
  }


  async triggerSync() {
    const latest = await this.#getLatestBlock()
    return this.syncChain(latest)
  }
}
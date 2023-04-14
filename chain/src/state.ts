import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import { formatBytes } from '@leofcoin/utils'
import Contract from './contract.js';
import Machine from './machine.js';

declare type SyncState = 'syncing' | 'synced' | 'errored' | 'connectionless'

export default class State extends Contract {
  #resolveErrored: boolean;
  #lastResolved: EpochTimeStamp;
  #syncState: SyncState;
  #lastBlockInQue: { index: 0, hash: '0x0'} | undefined;
  #syncErrorCount = 0;
  #blockHashMap = new Map();
  #chainSyncing: boolean = false;
  #lastBlock = {index: 0, hash: '0x0', previousHash: '0x0'};
  #blocks = [];
  #knownBlocks: Address[] = []
  #totalSize: number = 0;
  #machine: Machine;

  get blocks() {
    return [...this.#blocks]
  }

  get lastBlock() {
    return this.#lastBlock
  }

  get totalSize() {
    return this.#totalSize
  }
  
  constructor() {
    super()
  }

  async init() {
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
    }

    // load local blocks
    await this.resolveBlocks()
    this.#machine = await new Machine(this.#blocks)
    
    await this.#loadBlocks(this.#blocks)
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
      if (this.#blocks[index] && this.#blocks[index].hash !== block.hash) throw `invalid block ${hash} @${index}`
      if (!await globalThis.peernet.has(hash, 'block')) await globalThis.peernet.put(hash, block.encoded, 'block')
    }
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
      this.#resolveErrored = true
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

  async syncChain(lastBlock): Promise<SyncState > {
    if (!lastBlock) lastBlock = await this.#getLatestBlock()

    if (this.#chainSyncing) {
      console.log('already syncing');
      
      if (!this.#lastBlockInQue || lastBlock.index > this.#lastBlockInQue.index) this.#lastBlockInQue = lastBlock
      return 'syncing'
    }

    console.log('starting sync');
    
    this.#chainSyncing = true

    const syncPromise = (lastBlock) => new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#chainSyncing = false
        this.#syncErrorCount = 0
        reject('timedOut')
      }, 60000)
      try {
        await this.#syncChain(lastBlock)
        clearTimeout(timeout)
        resolve(true)
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    })
    
    if (globalThis.peernet.connections.length === 0) return 'connectionless'

    try {
      await syncPromise(lastBlock)
      
    } catch (error) {
      console.log(error);
      this.#syncErrorCount += 1
      if (this.#syncErrorCount < 3) await syncPromise(lastBlock)
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
    if (this.#knownBlocks?.length === Number(lastBlock.index) + 1) {
      let promises = []
      promises = await Promise.allSettled(this.#knownBlocks.map(async (address) => {
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
      let blocksSynced = localIndex > 0 ? (localIndex > index ? localIndex - index : index - localIndex) : index
      globalThis.debug(`synced ${blocksSynced} ${blocksSynced > 1 ? 'blocks' : 'block'}`)

      const start = (this.#blocks.length - blocksSynced) - 1
      if (this.#machine) await this.#loadBlocks(this.blocks.slice(start))
      await this.#updateState(new BlockMessage(this.#blocks[this.#blocks.length - 1]))
    }
  }

  async #getLatestBlock() {
    let promises = [];
    
    let data = await new globalThis.peernet.protos['peernet-request']({request: 'lastBlock'});
    let node = await globalThis.peernet.prepareMessage(data);

    for (const peer of globalThis.peernet?.connections) {
      if (peer.connected && peer.version === this.version) {        
        promises.push(async () => {
          try {
            const result = await peer.request(node.encoded)
            return {result, peer}
          } catch (error) {
            throw error
          }

        });
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
        this.#knownBlocks = message.decoded.response
      }
    }
    return latest
  }

  /**
   * 
   * @param {Block[]} blocks 
   */
  async #loadBlocks(blocks): Promise<boolean> {
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
            return false
          }
        }
        this.#blocks[block.index].loaded = true
        globalThis.debug(`loaded block: ${block.hash} @${block.index}`);
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
          const node = await new globalThis.peernet.protos['peernet-response'](value)
          return {value: node.decoded.response, peer: value.peer}
        })
        promises = await Promise.all(promises)
        
        resolve(promises)
      } else {
        resolve([])
      }
      
    })
    
  }
}
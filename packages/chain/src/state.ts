import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import { formatBytes } from '@leofcoin/utils'
import Contract from './contract.js'
import Machine from './machine.js'
import { nativeToken } from '@leofcoin/addresses'
import Jobber from './jobs/jobber.js'
import { BlockHash, BlockInMemory, RawBlock } from './types.js'
import { ResolveError, isExecutionError, isResolveError } from '@leofcoin/errors'

declare type SyncState = 'syncing' | 'synced' | 'errored' | 'connectionless'
declare type ChainState = 'loading' | 'loaded'

const debug = globalThis.createDebugger('leofcoin/state')

export default class State extends Contract {
  #resolveErrored: boolean
  #lastResolvedTime: EpochTimeStamp = 0
  #lastResolved: { index: 0; hash: '0x0'; previousHash: '0x0' }
  #resolving: boolean = false
  #resolveErrorCount: number = 0
  #syncState: SyncState
  #chainState: ChainState = 'loading'
  #lastBlockInQue: { index: 0; hash: '0x0' } | undefined
  #syncErrorCount = 0
  #blockHashMap = new Map()
  #chainSyncing: boolean = false
  #blocks = []
  knownBlocks: BlockHash[] = []
  #totalSize: number = 0
  #machine: Machine

  #loaded: boolean = false
  jobber: Jobber

  _wantList = []

  /**
   * contains transactions we need before we can successfully load
   */
  get wantList(): string[] {
    return this.#machine?.wantList ?? this._wantList
  }

  get state() {
    return {
      sync: this.#syncState,
      chain: this.#chainState
    }
  }

  get blockHashMap() {
    return this.#blockHashMap.entries()
  }

  get loaded() {
    return this.#loaded
  }

  get resolving() {
    return this.#resolving
  }

  get nativeCalls() {
    return this.#machine.nativeCalls
  }

  get nativeMints() {
    return this.#machine.nativeMints
  }

  get nativeBurns() {
    return this.#machine.nativeBurns
  }

  get nativeTransfers() {
    return this.#machine.nativeTransfers
  }

  get totalBurnAmouint() {
    return this.#machine.totalBurnAmount
  }

  get totalMintAmount() {
    return this.#machine.totalMintAmount
  }

  get totalTransferAmount() {
    return this.#machine.totalTransferAmount
  }

  get totalTransactions() {
    return this.#machine.totalTransactions
  }

  get totalBlocks() {
    return this.#machine.totalBlocks
  }

  get blocks() {
    return this.getBlocks()
  }

  get lastBlock() {
    return this.#machine ? this.#machine.lastBlock : { index: 0, hash: '0x0', previousHash: '0x0' }
  }

  getBlock(index) {
    return this.#machine.getBlock(index)
  }

  getBlocks(from?, to?) {
    return this.#machine.getBlocks(from, to)
  }

  get totalSize() {
    return this.#totalSize
  }

  get machine() {
    return this.#machine
  }

  constructor(config) {
    super(config)
  }

  async clearPool() {
    await globalThis.transactionPoolStore.clear()
  }

  /**
   * drastic measurement, removes everything!
   */
  async clearAll() {
    await globalThis.accountsStore.clear()
    await globalThis.chainStore.clear()
    await globalThis.blockStore.clear()
    await globalThis.transactionStore.clear()
    await globalThis.stateStore.clear()
    await globalThis.transactionPoolStore.clear()
  }

  #chainStateHandler = () => {
    return new globalThis.peernet.protos['peernet-response']({
      response: this.#chainState
    })
  }

  #lastBlockHandler = async () => {
    return new globalThis.peernet.protos['peernet-response']({
      response: await this.lastBlock
    })
  }

  #knownBlocksHandler = async () => {
    return new globalThis.peernet.protos['peernet-response']({
      response: { blocks: this.#blocks.map((block) => block.hash) }
    })
  }

  async init() {
    this.jobber = new Jobber(this.resolveTimeout)
    if (super.init) await super.init()
    await globalThis.peernet.addRequestHandler('lastBlock', this.#lastBlockHandler)
    await globalThis.peernet.addRequestHandler('knownBlocks', this.#knownBlocksHandler)
    await globalThis.peernet.addRequestHandler('chainState', this.#chainStateHandler)

    try {
      await globalThis.chainStore.has('lastBlock')
    } catch {
      await globalThis.chainStore.put('lastBlock', '0x0')
    }
    globalThis.pubsub.publish('lastBlock', await this.lastBlock)
    // load local blocks
    try {
      this.knownBlocks = await blockStore.keys()
    } catch (error) {
      console.error(error)
      throw error
    }

    try {
      let localBlockHash
      try {
        const localBlock = await globalThis.chainStore.get('lastBlock')
        localBlockHash = new TextDecoder().decode(localBlock)
      } catch (error) {}
      if (localBlockHash && localBlockHash !== '0x0') {
        const blockMessage = new BlockMessage(await peernet.get(localBlockHash, 'block'))
        try {
          const states = {
            lastBlock: JSON.parse(new TextDecoder().decode(await globalThis.stateStore.get('lastBlock')))
          }

          if (blockMessage.decoded.index > states.lastBlock.index) await this.resolveBlocks()
        } catch (error) {
          // no states found, try resolving blocks
          await this.resolveBlocks()
        }
      } else {
        await this.resolveBlocks()
      }

      this.#machine = await new Machine(this.#blocks)

      const lastBlock = await this.#machine.lastBlock

      if (lastBlock.hash !== '0x0') {
        this.updateState(new BlockMessage(lastBlock))
      }

      this.#loaded = true
      // await this.#loadBlocks(this.#blocks)
    } catch (error) {
      console.log('e')

      if (isResolveError(error)) {
        console.error(error)
      }
      console.log(error)
    }
  }

  async updateState(message: BlockMessage) {
    try {
      const hash = await message.hash()
      await globalThis.chainStore.put('lastBlock', hash)
      globalThis.pubsub.publish('lastBlock', message.encoded)
      if (!this.#machine) this.#machine = await new Machine(this.#blocks)
      await this.#machine.updateState()
    } catch (error) {
      console.error(error)
    }
  }

  getLatestBlock(): Promise<BlockMessage['decoded']> {
    // @ts-ignore
    return this.#getLatestBlock()
  }

  async getAndPutBlock(hash: string): Promise<BlockMessage> {
    // todo peernet resolves undefined blocks....
    let block = await globalThis.peernet.get(hash, 'block')
    if (block !== undefined) {
      block = await new BlockMessage(block)
      const { index } = block.decoded
      if (this.#blocks[index] && this.#blocks[index].hash !== block.hash) throw `invalid block ${hash} @${index}`
      if (!(await globalThis.peernet.has(hash))) await globalThis.peernet.put(hash, block.encoded, 'block')
    }
    return block
  }

  async #resolveBlock(hash) {
    let index = this.#blockHashMap.get(hash)

    if (this.#blocks[index]) {
      if (this.#blocks[index].previousHash !== '0x0') {
        return this.resolveBlock(this.#blocks[index].previousHash)
      } else {
        return
      }
    }
    try {
      const block = await this.getAndPutBlock(hash)
      await Promise.all(
        block.decoded.transactions.map(async (hash) => {
          // should be in a transaction store already
          if (!(await transactionStore.has(hash))) {
            const data = await peernet.get(hash, 'transaction')
            await transactionStore.put(hash, data)
          }
          ;(await transactionPoolStore.has(hash)) && (await transactionPoolStore.delete(hash))
        })
      )
      index = block.decoded.index
      const size = block.encoded.length > 0 ? block.encoded.length : block.encoded.byteLength
      this.#totalSize += size
      this.#blocks[index] = { hash, ...block.decoded }
      this.#blockHashMap.set(hash, index)
      debug(`resolved block: ${hash} @${index} ${formatBytes(size)}`)
      globalThis.pubsub.publish('block-resolved', { hash, index })
      this.#lastResolved = this.#blocks[index]
      this.#lastResolvedTime = Date.now()
    } catch (error) {
      throw new ResolveError(`block: ${hash}@${index}`)
    }
    return
  }

  async resolveBlock(hash) {
    if (!hash) throw new Error(`expected hash, got: ${hash}`)
    if (hash === '0x0') return
    if (this.#resolving) return 'already resolving'
    this.#resolving = true
    if (this.jobber.busy && this.jobber.destroy) await this.jobber.destroy()
    try {
      await this.jobber.add(() => this.#resolveBlock(hash))
      this.#resolving = false

      if (!this.#blockHashMap.has(this.#lastResolved.previousHash) && this.#lastResolved.previousHash !== '0x0')
        return this.resolveBlock(this.#lastResolved.previousHash)
    } catch (error) {
      console.log({ error })

      this.#resolveErrorCount += 1
      this.#resolving = false

      if (this.#resolveErrorCount < 3) return this.resolveBlock(hash)

      this.#resolveErrorCount = 0
      this.wantList.push(hash)
      throw new ResolveError(`block: ${hash}`, { cause: error })
    }
  }

  async resolveBlocks() {
    try {
      if (this.jobber.busy && this.jobber.destroy) {
        await this.jobber.destroy()
      }
    } catch (error) {
      console.error(error)
    }

    try {
      const localBlock = await globalThis.chainStore.get('lastBlock')

      const hash = new TextDecoder().decode(localBlock)

      if (hash && hash !== '0x0') {
        await this.resolveBlock(hash)
      }
    } catch (error) {
      console.log(error)
      this.#chainSyncing = false
      this.#syncState = 'errored'

      this.#resolveErrored = true
      return this.restoreChain()
      // console.log(e);
    }
  }

  async restoreChain() {
    try {
      const { hash } = await this.#getLatestBlock()
      await globalThis.chainStore.put('lastBlock', hash)
      if (hash && hash !== '0x0') {
        await this.resolveBlock(hash)
      }
    } catch (error) {
      console.log(error)
      this.#resolveErrored = true
      this.#resolveErrorCount += 1
      this.#resolving = false
      return this.restoreChain()
      // console.log(e);
    }
  }

  async syncChain(lastBlock?): Promise<SyncState> {
    console.log('check if can sync')

    if (!this.shouldSync) return
    console.log('starting sync')
    this.#syncState = 'syncing'
    this.#chainSyncing = true

    try {
      if (this.jobber.busy && this.jobber.destroy) {
        await this.jobber.destroy()
      }
    } catch (error) {
      console.error(error)
    }

    if (!lastBlock) lastBlock = await this.#getLatestBlock()

    console.log('starting sync')

    if (globalThis.peernet.peers.length === 0) return 'connectionless'

    try {
      await this.#syncChain(lastBlock)
    } catch (error) {
      this.#syncErrorCount += 1
      if (this.#syncErrorCount < 3) return this.syncChain(lastBlock)
      this.#syncErrorCount = 0
      this.#chainSyncing = false
      this.#syncState = 'errored'
      return this.#syncState
    }
    if (lastBlock.index === this.#lastBlockInQue?.index) this.#lastBlockInQue = undefined
    this.#syncErrorCount = 0
    this.#chainSyncing = false
    if (this.#lastBlockInQue) return this.syncChain(this.#lastBlockInQue)
    this.#syncState = 'synced'
    return this.#syncState
  }

  async #syncChain(lastBlock) {
    try {
      if (this.knownBlocks?.length === Number(lastBlock.index) + 1) {
        let promises = []
        promises = await Promise.allSettled(
          this.knownBlocks.map(async (address) => {
            const has = await globalThis.peernet.has(address)
            return { has, address }
          })
        )
        promises = promises.filter(({ status, value }) => status === 'fulfilled' && !value.has)

        await Promise.allSettled(promises.map(({ value }) => this.getAndPutBlock(value.address)))
      }

      const localBlock = await this.lastBlock

      if (!localBlock || Number(localBlock.index) < Number(lastBlock.index)) {
        // TODO: check if valid
        const localIndex = localBlock ? localBlock.index : 0
        const index = lastBlock.index
        await this.resolveBlock(lastBlock.hash)
        console.log('ok')

        let blocksSynced =
          localIndex > 0 ? (localIndex > index ? localIndex - index + 1 : index + -localIndex + 1) : index + 1
        debug(`synced ${blocksSynced} ${blocksSynced > 1 ? 'blocks' : 'block'}`)
        const blocks = this.#blocks

        const start = blocks.length - blocksSynced
        if (this.#machine) {
          await this.#loadBlocks(blocks.slice(start))
        }
        await this.updateState(new BlockMessage(blocks[blocks.length - 1]))
      }
    } catch (error) {
      console.log(error)

      throw error
    }
  }

  async #getLatestBlock() {
    let promises = []

    let data = await new globalThis.peernet.protos['peernet-request']({
      request: 'lastBlock'
    })
    let node = await globalThis.peernet.prepareMessage(data)

    for (const id in globalThis.peernet.connections) {
      // @ts-ignore
      const peer = globalThis.peernet.connections[id]
      if (peer.connected && peer.version === this.version) {
        const task = async () => {
          try {
            const result = await peer.request(node.encode())
            return { result: Uint8Array.from(Object.values(result)), peer }
          } catch (error) {
            throw error
          }
        }
        promises.push(task())
      }
    }
    // @ts-ignore
    promises = await this.promiseRequests(promises)
    let latest = { index: 0, hash: '0x0', previousHash: '0x0' }

    promises = promises.sort((a, b) => b.index - a.index)

    if (promises.length > 0) latest = promises[0].value

    if (latest.hash && latest.hash !== '0x0') {
      let message = await globalThis.peernet.get(latest.hash, 'block')
      message = await new BlockMessage(message)
      const hash = await message.hash()
      if (hash !== latest.hash) throw new Error('invalid block @getLatestBlock')

      latest = { ...message.decoded, hash }

      const peer = promises[0].peer

      if (peer.connected && peer.version === this.version) {
        let data = await new globalThis.peernet.protos['peernet-request']({
          request: 'knownBlocks'
        })
        let node = await globalThis.peernet.prepareMessage(data)

        let message = await peer.request(node.encode())
        message = await new globalThis.peernet.protos['peernet-response'](message)
        this.knownBlocks = message.decoded.response
      }
    }
    return latest
  }

  #loadBlockTransactions = (transactions): Promise<TransactionMessage[]> =>
    Promise.all(transactions.map(async (transaction) => new TransactionMessage(await peernet.get(transaction))))

  #getLastTransactions = async () => {
    let lastTransactions = (
      await Promise.all(
        (
          await this.blocks
        )
          // @ts-ignore
          .filter((block) => block.loaded)
          .slice(-24)
          // @ts-ignore
          .map((block) => this.#loadBlockTransactions(block.transactions))
      )
    ).reduce((all, transactions) => [...all, ...transactions], [])

    return Promise.all(lastTransactions.map((transaction) => transaction.hash()))
  }

  // todo throw error
  async #_executeTransaction(transaction) {
    try {
      await this.#machine.execute(transaction.decoded.to, transaction.decoded.method, transaction.decoded.params)
      // await globalThis.accountsStore.put(transaction.decoded.from, String(transaction.decoded.nonce))
      // if (transaction.decoded.to === nativeToken) {
      //   this.#nativeCalls += 1
      //   if (transaction.decoded.method === 'burn') this.#nativeBurns += 1
      //   if (transaction.decoded.method === 'mint') this.#nativeMints += 1
      //   if (transaction.decoded.method === 'transfer') this.#nativeTransfers += 1
      // }
      // this.#totalTransactions += 1
    } catch (error) {
      console.log(error)

      await globalThis.transactionPoolStore.delete(await transaction.hash())
      console.log('removing invalid transaction')
      if (isExecutionError(error)) {
        console.log(error)

        // console.log(`removing invalid block ${block.index}`)
        // await globalThis.blockStore.delete(await (await new BlockMessage(block)).hash())
        // const deletedBlock = blocks.splice(block.index, 1)
        // console.log(`removed block ${deletedBlock[0].index}`)

        // return this.#loadBlocks(blocks)
      }

      console.log(error)
      return false
    }
  }
  /**
   *
   * @param {Block[]} blocks
   */
  async #loadBlocks(blocks: BlockInMemory[]): Promise<boolean> {
    this.#chainState = 'loading'
    let poolTransactionKeys = await globalThis.transactionPoolStore.keys()

    for (const block of blocks) {
      if (block && !block.loaded) {
        try {
          let transactions = await this.#loadBlockTransactions([...block.transactions] || [])
          // const lastTransactions = await this.#getLastTransactions()

          let priority = []
          for (const transaction of transactions) {
            const hash = await transaction.hash()
            // if (lastTransactions.includes(hash)) {
            //   console.log('removing invalid block')
            //   await globalThis.blockStore.delete(await (await new BlockMessage(block)).hash())
            //   blocks.splice(block.index - 1, 1)
            //   return this.#loadBlocks(blocks)
            // }
            if (transaction.decoded.priority) priority.push(transaction)
            if (poolTransactionKeys.includes(hash)) await globalThis.transactionPoolStore.delete(hash)
          }

          // prority blocks execution from the rest so result in higher fees.
          if (priority.length > 0) {
            priority = priority.sort((a, b) => a.nonce - b.nonce)
            for (const transaction of priority) {
              await this.#_executeTransaction(transaction)
            }
          }
          transactions = transactions.filter((transaction) => !transaction.decoded.priority)
          await Promise.all(transactions.map((transaction) => this.#_executeTransaction(transaction)))
          this.#blocks[block.index].loaded = true

          if (block.index === 0) this.#loaded = true
          await this.#machine.addLoadedBlock(block)
          // @ts-ignore
          debug(`loaded block: ${block.hash} @${block.index}`)
          globalThis.pubsub.publish('block-loaded', { ...block })
        } catch (error) {
          console.error(error)
          for (const transaction of block.transactions) {
            this.wantList.push(transaction)
          }
        }
      }
    }
    this.#chainState = 'loaded'
    return true
  }

  promiseRequests(promises) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve([{ index: 0, hash: '0x0' }])
        debug('sync timed out')
      }, this.requestTimeout)

      promises = await Promise.allSettled(promises)
      promises = promises.filter(({ status }) => status === 'fulfilled')
      clearTimeout(timeout)

      if (promises.length > 0) {
        promises = promises.map(async ({ value }) => {
          const node = await new globalThis.peernet.protos['peernet-response'](value.result)
          return { value: node.decoded.response, peer: value.peer }
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
    if (this.#chainSyncing) return false
    if (
      !this.#chainSyncing ||
      this.#resolveErrored ||
      this.#syncState === 'errored' ||
      this.#syncState === 'connectionless' ||
      this.#lastResolvedTime + this.resolveTimeout > Date.now()
    )
      return true

    return false
  }

  async triggerSync() {
    const latest = await this.#getLatestBlock()
    return this.syncChain(latest)
  }

  async triggerLoad() {
    if (this.#blocks.length > 0) {
      this.#machine = await new Machine(this.#blocks)
    }
  }
}

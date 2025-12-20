import { createDebugger } from '@vandeurenglenn/debug'
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

const debug = createDebugger('leofcoin/state')

export default class State extends Contract {
  #blockHashMap = new Map()
  #blocks = []
  #machine: Machine
  #loaded: boolean = false
  jobber: Jobber

  // Sync state
  #syncing: boolean = false
  #syncErrorCount = 0

  // Block resolution state
  #resolvingBlocks = new Set<string>()
  #maxConcurrentResolves = 10

  knownBlocks: BlockHash[] = []
  #totalSize: number = 0
  _wantList = []
  #lastResolved: any
  #lastResolvedTime: number
  #blockResolveQueue: any
  #chainState: string

  /**
   * contains transactions we need before we can successfully load
   */
  get wantList(): string[] {
    return this.#machine?.wantList ?? this._wantList
  }

  get loaded() {
    return this.#loaded
  }

  get isSyncing() {
    return this.#syncing
  }

  // Delegate to machine
  get contracts() {
    return this.#machine.contracts
  }

  get totalContracts() {
    return this.#machine.totalContracts
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

  get lastBlockHeight() {
    return this.#machine ? this.#machine.lastBlockHeight : 0
  }

  get totalSize() {
    return this.#totalSize
  }

  get machine() {
    return this.#machine
  }

  get blockHashMap() {
    return this.#blockHashMap.entries()
  }

  getBlock(index) {
    return this.#machine.getBlock(index)
  }

  getBlocks(from?, to?) {
    return this.#machine.getBlocks(from, to)
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
      response: { syncing: this.#syncing, loaded: this.#loaded }
    })
  }

  #lastBlockHandler = async () => {
    return new globalThis.peernet.protos['peernet-response']({
      response: await this.lastBlock
    })
  }

  #knownBlocksHandler = async () => {
    return new globalThis.peernet.protos['peernet-response']({
      response: { blocks: await globalThis.blockStore.keys() }
    })
  }

  async init() {
    // Initialize jobber for timed, cancelable tasks
    this.jobber = new Jobber(this.resolveTimeout)
    // Register request handlers
    await globalThis.peernet.addRequestHandler('lastBlock', this.#lastBlockHandler.bind(this))
    await globalThis.peernet.addRequestHandler('knownBlocks', this.#knownBlocksHandler.bind(this))
    await globalThis.peernet.addRequestHandler('chainState', this.#chainStateHandler.bind(this))

    try {
      // Load local block state
      let localBlock = { index: 0, hash: '0x0', previousHash: '0x0' }

      try {
        const localBlockHash = new TextDecoder().decode(await globalThis.chainStore.get('lastBlock'))
        if (localBlockHash && localBlockHash !== '0x0') {
          const blockMessage = await new BlockMessage(await globalThis.peernet.get(localBlockHash, 'block'))
          localBlock = { ...blockMessage.decoded, hash: localBlockHash }
        }
      } catch (error) {
        debug('No local block found')
      }

      // Load known blocks
      try {
        this.knownBlocks = await globalThis.blockStore.keys()
      } catch (error) {
        debug('No known blocks found')
      }

      // Initialize machine and resolve blocks if needed
      this.#machine = await new Machine(this.#blocks)

      if (localBlock.hash !== '0x0') {
        await this.resolveBlock(localBlock.hash)
      }

      const lastBlock = await this.#machine.lastBlock
      if (lastBlock.hash !== '0x0') {
        await this.updateState(new BlockMessage(lastBlock))
      }

      this.#loaded = true
    } catch (error) {
      console.error('Failed to initialize state:', error)
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

  async #resolveBlock(hash: string): Promise<void> {
    if (this.#resolvingBlocks.has(hash)) {
      return // Already resolving this block
    }

    this.#resolvingBlocks.add(hash)

    try {
      let index = this.#blockHashMap.get(hash)

      debug(`resolving block: ${hash} @${index !== undefined ? index : 'unknown'}`)

      if (this.#blocks[index]) {
        // Block already exists
        return
      }

      const block = await this.getAndPutBlock(hash)
      index = block.decoded.index
      const size = block.encoded.length > 0 ? block.encoded.length : block.encoded.byteLength

      // Batch transaction operations
      const transactionsToFetch: string[] = []
      const transactionHashes = block.decoded.transactions || []

      for (const txHash of transactionHashes) {
        if (!(await globalThis.transactionStore.has(txHash))) {
          transactionsToFetch.push(txHash)
        }
      }

      // Fetch all missing transactions in parallel
      if (transactionsToFetch.length > 0) {
        const fetchedResults = await Promise.allSettled(
          transactionsToFetch.map((txHash) => globalThis.peernet.get(txHash, 'transaction'))
        )

        // Batch store all transactions that were successfully fetched
        for (let i = 0; i < fetchedResults.length; i++) {
          if (fetchedResults[i].status === 'fulfilled') {
            await globalThis.transactionStore.put(transactionsToFetch[i], fetchedResults[i].value)
          } else {
            debug(
              `failed to fetch transaction ${transactionsToFetch[i]}: ${
                fetchedResults[i].reason?.message || fetchedResults[i].reason
              }`
            )
          }
        }
      }

      // Remove from pool
      await Promise.all(
        transactionHashes.map(async (txHash) => {
          if (await globalThis.transactionPoolStore.has(txHash)) {
            await globalThis.transactionPoolStore.delete(txHash)
          }
        })
      )

      this.#totalSize += size
      this.#blocks[index] = { hash, ...block.decoded }
      this.#blockHashMap.set(hash, index)
      debug(`resolved block: ${hash} @${index} ${formatBytes(size)}`)
      globalThis.pubsub.publish('block-resolved', { hash, index })
      this.#lastResolved = this.#blocks[index]
      this.#lastResolvedTime = Date.now()
    } catch (error) {
      throw new ResolveError(`block: ${hash}`)
    } finally {
      this.#resolvingBlocks.delete(hash)
    }
  }

  async #buildBlockChain(latestHash: string, maxBlocks: number = 1000): Promise<string[]> {
    const chain: string[] = []
    let currentHash = latestHash
    let attempts = 0

    while (currentHash !== '0x0' && chain.length < maxBlocks && attempts < maxBlocks + 5) {
      attempts++

      // Check if we already have this block
      if (this.#blockHashMap.has(currentHash)) {
        const block = this.#blocks[this.#blockHashMap.get(currentHash)]
        if (block) {
          chain.push(currentHash)
          currentHash = block.previousHash
          continue
        }
      }

      chain.push(currentHash)

      // Try to get the block to find previous hash
      try {
        const block = await this.getAndPutBlock(currentHash)
        currentHash = block.decoded.previousHash
      } catch (error) {
        debug(`Could not fetch block ${currentHash} to determine chain: ${error}`)
        break
      }
    }

    return chain
  }

  async #resolveBlocksInParallel(hashes: string[]): Promise<void> {
    // Resolve blocks in parallel with concurrency limit
    const resolving: Promise<void>[] = []
    let index = 0

    const resolveNext = async () => {
      while (index < hashes.length) {
        const hash = hashes[index++]
        try {
          await this.#resolveBlock(hash)
        } catch (error) {
          debug(`Failed to resolve block ${hash}: ${error}`)
          this.#blockResolveQueue.push({ hash, retries: 0 })
        }
      }
    }

    // Start concurrent resolution tasks
    for (let i = 0; i < Math.min(this.#maxConcurrentResolves, hashes.length); i++) {
      resolving.push(resolveNext())
    }

    await Promise.all(resolving)
  }

  async resolveBlock(hash: string): Promise<void> {
    if (!hash || hash === '0x0') return
    if (this.#syncing) return

    this.#syncing = true
    this.#syncErrorCount = 0

    try {
      debug(`Building block chain from ${hash}`)
      const blockChain = await this.#buildBlockChain(hash)
      debug(`Built chain of ${blockChain.length} blocks`)

      if (blockChain.length > 0) {
        // If a previous resolve job is still running, cancel it
        if (this.jobber?.busy && this.jobber.destroy) await this.jobber.destroy()
        // Run the parallel resolution inside a timed jobber task
        await this.jobber.add(() => this.#resolveBlocksInParallel(blockChain))
      }
    } catch (error) {
      console.error('Block resolution failed:', error)
      this.wantList.push(hash)
    } finally {
      this.#syncing = false
    }
  }

  async resolveBlocks() {
    if (this.#syncing) return
    try {
      const localBlock = await globalThis.chainStore.get('lastBlock')
      const hash = new TextDecoder().decode(localBlock)
      if (hash && hash !== '0x0') {
        // Cancel any in-flight job before starting a new one
        if (this.jobber?.busy && this.jobber.destroy) await this.jobber.destroy()
        // Build chain and resolve in parallel under jobber control
        const run = async () => {
          const chain = await this.#buildBlockChain(hash)
          if (chain.length > 0) {
            await this.#resolveBlocksInParallel(chain)
          }
        }
        await this.jobber.add(run)
      }
    } catch (error) {
      debug('Failed to resolve blocks:', error)
    }
  }

  async syncChain(lastBlock?): Promise<'syncing' | 'synced' | 'errored' | 'connectionless'> {
    if (this.#syncing) return 'syncing'
    if (!lastBlock) lastBlock = await this.#getLatestBlock()

    this.#syncing = true
    try {
      if (globalThis.peernet.peers.length === 0) {
        this.#syncing = false
        return 'connectionless'
      }

      await this.resolveBlock(lastBlock.hash)
      const blocks = this.#blocks
      const localIndex = (await this.lastBlock).index || -1
      const start = Math.max(0, localIndex + 1)

      if (this.#machine && blocks.length > start) {
        await this.#loadBlocks(blocks.slice(start))
      }

      if (blocks.length > 0) {
        await this.updateState(new BlockMessage(blocks[blocks.length - 1]))
      }

      this.#syncErrorCount = 0
      this.#syncing = false
      return 'synced'
    } catch (error) {
      this.#syncErrorCount++
      if (this.#syncErrorCount < 3) {
        this.#syncing = false
        return this.syncChain(lastBlock)
      }
      this.#syncErrorCount = 0
      this.#syncing = false
      return 'errored'
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
            debug({ result })
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
    console.log({ promises })
    let latest = { index: 0, hash: '0x0', previousHash: '0x0' }

    promises = promises.sort((a, b) => b.index - a.index)

    if (promises.length > 0) latest = promises[0].value
    debug(`Latest block from peers: ${latest.hash} @${latest.index}`)
    if (latest.hash && latest.hash !== '0x0') {
      let message = await globalThis.peernet.get(latest.hash, 'block')
      debug({ message })
      message = await new BlockMessage(message)
      debug({ message })
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
        this.wantList.push(...message.decoded.response)
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
    debug(`pool transactions: ${poolTransactionKeys.length}`)
    debug(`loading ${blocks.length} blocks`)
    for (const block of blocks) {
      if (block && !block.loaded) {
        try {
          debug(`loading block: ${Number(block.index)} ${block.hash}`)
          let transactions = await this.#loadBlockTransactions([...block.transactions] || [])
          // const lastTransactions = await this.#getLastTransactions()

          debug(`loading transactions: ${transactions.length} for block ${block.index}`)
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
            debug(`executing ${priority.length} priority transactions for block ${block.index}`)
            priority = priority.sort((a, b) => a.nonce - b.nonce)
            for (const transaction of priority) {
              await this.#_executeTransaction(transaction)
            }
          }

          transactions = transactions.filter((transaction) => !transaction.decoded.priority)
          debug(`executing ${transactions.length} transactions for block ${block.index}`)
          await Promise.all(transactions.map((transaction) => this.#_executeTransaction(transaction)))
          this.#blocks[block.index].loaded = true

          debug(`executed transactions for block ${block.index}`)
          if (Number(block.index) === 0) this.#loaded = true
          await this.#machine.addLoadedBlock(block)
          // @ts-ignore
          debug(`loaded block: ${block.hash} @${Number(block.index)}`)
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
    return !this.#syncing
  }

  get shouldSync() {
    if (this.#syncing) return false

    const compatiblePeers = Object.values(globalThis.peernet.connections || {}).filter(
      (peer) => peer.connected && peer.version === this.version
    )

    return compatiblePeers.length > 0
  }

  async #waitForPeers(timeoutMs = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const checkPeers = () => {
        const peers = Object.values(globalThis.peernet.connections || {}).filter(
          (peer) => peer.connected && peer.version === this.version
        )

        if (peers.length > 0) {
          resolve(true)
        }
      }

      // Check immediately
      checkPeers()

      // Set up interval to check periodically
      const interval = setInterval(checkPeers, 1000)

      // Set timeout
      setTimeout(() => {
        clearInterval(interval)
        resolve(false)
      }, timeoutMs)
    })
  }

  async triggerSync() {
    const latest = await this.#getLatestBlock()
    return this.syncChain(latest)
  }

  async triggerLoad() {
    if (this.#blocks?.length > 0) {
      this.#machine = await new Machine(this.#blocks)
    }
  }
}

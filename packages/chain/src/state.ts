import { createDebugger } from '@vandeurenglenn/debug'
import {
  ContractMessage,
  TransactionMessage,
  BlockMessage,
  BWMessage,
  BWRequestMessage,
  LastBlockMessage
} from '@leofcoin/messages'
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
  #resolvingHashes: Set<string> = new Set()

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

  async #resolveLastBlockMessage(result: unknown) {
    if (result instanceof Uint8Array) {
      try {
        let payload: unknown = result
        for (let i = 0; i < 3; i += 1) {
          try {
            const wrapped = await new globalThis.peernet.protos['peernet-response'](payload)
            if (wrapped?.decoded?.response === undefined) break
            payload = wrapped.decoded.response
          } catch {
            break
          }
        }
        if (payload !== result) return this.#resolveLastBlockMessage(payload)

        return new LastBlockMessage(result)
      } catch {
        const candidate = new TextDecoder().decode(result)
        if (candidate) {
          const blockData = await globalThis.peernet.get(candidate, 'block')
          if (blockData) return new BlockMessage(blockData)
        }
      }
    }

    if (typeof result === 'string') {
      const blockData = await globalThis.peernet.get(result, 'block')
      if (blockData) return new BlockMessage(blockData)
    }

    if (result && typeof result === 'object') {
      const response = (result as any).decoded?.response ?? (result as any).response
      if (response !== undefined) return this.#resolveLastBlockMessage(response)
      if ('hash' in result && 'index' in result) {
        return new LastBlockMessage(result)
      }
    }

    throw new Error(`invalid lastBlock payload: ${typeof result}`)
  }

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
      response: new LastBlockMessage(await this.lastBlock).encoded
    })
  }

  #knownBlocksHandler = async () => {
    return new globalThis.peernet.protos['peernet-response']({
      response: { blocks: await globalThis.blockStore.keys() }
    })
  }

  async init() {
    debug('State init start')
    this.jobber = new Jobber(this.resolveTimeout)
    await globalThis.peernet.addRequestHandler('lastBlock', this.#lastBlockHandler)
    await globalThis.peernet.addRequestHandler('knownBlocks', this.#knownBlocksHandler)
    await globalThis.peernet.addRequestHandler('chainState', this.#chainStateHandler)

    let localBlockHash
    let blockMessage
    let localBlock

    console.log('State init before try-catch')
    try {
      const rawBlock = await globalThis.chainStore.has('lastBlock')
      console.log('State init after has lastBlock check')
      if (rawBlock) {
        console.log('State init after has lastBlock found')
        console.log(rawBlock)
        localBlockHash = new TextDecoder().decode(await globalThis.chainStore.get('lastBlock'))
        console.log(localBlockHash)

        if (localBlockHash !== '0x0') {
          blockMessage = await globalThis.blockStore.get(localBlockHash)

          console.log(blockMessage)
          blockMessage = await new BlockMessage(blockMessage)
          localBlock = { ...blockMessage.decoded, hash: localBlockHash }
        }
        console.log('State init after localBlock set')
      } else {
        localBlock = { index: 0, hash: '0x0', previousHash: '0x0' }
      }
    } catch {
      console.log('e')

      console.log('State init middle')
      localBlock = { index: 0, hash: '0x0', previousHash: '0x0' }
    }
    console.log('State init middle')

    try {
      console.log('fetching known blocks from blockStore')
      this.knownBlocks = await globalThis.blockStore.keys()
    } catch (error) {
      console.log('no local known blocks found')
    }

    try {
      if (localBlock?.hash && localBlock.hash !== '0x0') {
        try {
          // Avoid JSON decode here; just check if persisted state snapshot exists.
          if (!(await globalThis.stateStore.has('lastBlock'))) {
            await this.resolveBlocks()
          }
        } catch {
          // no state marker found, try resolving blocks
          await this.resolveBlocks()
        }
      } else {
        await this.resolveBlocks()
      }

      const machine = new Machine(this.#blocks)
      console.log(machine)

      await machine.ready
      this.#machine = machine

      const lastBlock = await this.#machine.lastBlock

      if (lastBlock.hash !== '0x0') {
        this.updateState(new BlockMessage(lastBlock))
      }

      this.#loaded = true
      this.#chainState = 'loaded'
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
      if (!this.#machine) {
        const machine = new Machine(this.#blocks)
        console.log(machine)

        await machine.ready
        this.#machine = machine
      }
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
      if (!(block instanceof Uint8Array)) {
        block = new Uint8Array(Object.values(block))
      }
      block = await new BlockMessage(block)

      const { index } = block.decoded
      if (this.#blocks[index] && this.#blocks[index].hash !== block.hash) throw `invalid block ${hash} @${index}`
      if (!(await globalThis.peernet.has(hash))) await globalThis.peernet.put(hash, block.encoded, 'block')
    }
    return block
  }

  async #resolveTransactions(transactions: string[]) {
    await Promise.all(
      transactions
        .filter((hash) => Boolean(hash))
        .map(async (hash) => {
          // should be in a transaction store already
          const exists = await transactionStore.has(hash)
          if (!exists) {
            const data = await peernet.get(hash, 'transaction')
            if (!data) throw new Error(`missing transaction data for ${hash}`)
            await transactionStore.put(hash, data)
          }
          const inPool = await transactionPoolStore.has(hash)
          if (inPool) await transactionPoolStore.delete(hash)
        })
    )
  }

  async #resolveBlock(hash) {
    let index = this.#blockHashMap.get(hash)
    let localHash = '0x0'
    try {
      const rawLocalHash = await globalThis.stateStore.get('lastBlock')
      if (rawLocalHash) {
        const decoded = JSON.parse(new TextDecoder().decode(rawLocalHash))
        localHash = typeof decoded === 'string' ? decoded : decoded?.hash ?? '0x0'
      }
    } catch (error) {
      debug('no local state found')
    }
    if (this.#blocks[index]) {
      // Block already exists, check if we need to resolve previous blocks
      const previousHash = this.#blocks[index].previousHash
      if (previousHash === localHash) return
      if (previousHash !== '0x0') {
        // Previous block not in memory, recursively resolve it
        return this.resolveBlock(previousHash)
      } else {
        // Previous block already exists or is genesis, stop resolving
        return
      }
    }
    try {
      const block = await this.getAndPutBlock(hash)

      const promises = []
      if (block.decoded.previousHash !== '0x0' && block.decoded.previousHash !== localHash) {
        promises.push(this.resolveBlock(block.decoded.previousHash))
      }

      promises.push(this.#resolveTransactions(block.decoded.transactions as unknown as string[]))

      await Promise.all(promises)

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
      throw new ResolveError(`block: ${hash}@${index}`, { cause: error })
    }
    return
  }

  async resolveBlock(hash) {
    if (!hash) throw new Error(`expected hash, got: ${hash}`)
    if (hash === '0x0') return
    if (this.#resolvingHashes.has(hash)) return
    this.#resolvingHashes.add(hash)
    const isEntering = this.#resolvingHashes.size === 1
    this.#resolving = true

    try {
      if (isEntering) {
        if (this.jobber.busy && this.jobber.destroy) await this.jobber.destroy()
        await this.jobber.add(() => this.#resolveBlock(hash))
      } else {
        await this.#resolveBlock(hash)
      }

      try {
        const lastBlockHash = await globalThis.stateStore.get('lastBlock')

        if (lastBlockHash === hash) {
          this.#resolveErrored = false
          return
        }
      } catch (error) {}
    } catch (error) {
      console.log({ error })

      this.#resolveErrorCount += 1

      if (this.#resolveErrorCount < 3) {
        this.#resolvingHashes.delete(hash)
        return this.resolveBlock(hash)
      }

      this.#resolveErrorCount = 0
      this.wantList.push(hash)
      throw new ResolveError(`block: ${hash}`, { cause: error })
    } finally {
      this.#resolvingHashes.delete(hash)
      if (this.#resolvingHashes.size === 0) this.#resolving = false
    }
  }

  async resolveBlocks() {
    // Don't re-resolve if already syncing or resolving
    if (this.#chainSyncing || this.#resolving) {
      debug('Already syncing or resolving, skipping resolveBlocks()')
      return
    }

    try {
      if (this.jobber.busy && this.jobber.destroy) {
        await this.jobber.destroy()
      }
    } catch (error) {
      console.error(error)
    }

    try {
      if (!(await globalThis.chainStore.has('lastBlock'))) {
        if (this.knownBlocks.length === 0) {
          this.#syncState = 'connectionless'
          return
        }
        return this.restoreChain()
      }

      const localBlock = await globalThis.chainStore.get('lastBlock')

      const hash = new TextDecoder().decode(localBlock)

      if (hash && hash !== '0x0') {
        debug(`Resolving blocks from hash: ${hash}`)
        await this.resolveBlock(hash)
      }
    } catch (error) {
      console.log(error)
      this.#chainSyncing = false
      this.#syncState = 'errored'

      this.#resolveErrored = true
      if (globalThis.peernet.peers.length === 0) return
      return this.restoreChain()
      // console.log(e);
    }
  }

  async restoreChain() {
    if (globalThis.peernet.peers.length === 0 && this.knownBlocks.length === 0) {
      this.#syncState = 'connectionless'
      return
    }

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
      if (this.#resolveErrorCount >= 3) {
        this.#syncState = 'errored'
        throw new ResolveError('unable to restore chain after 3 attempts', { cause: error })
      }
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
      // if (this.knownBlocks?.length === Number(lastBlock.index) + 1) {
      //   let promises = []
      //   promises = await Promise.allSettled(
      //     this.knownBlocks.map(async (address) => {
      //       const has = await globalThis.peernet.has(address)
      //       return { has, address }
      //     })
      //   )
      //   promises = promises.filter(({ status, value }) => status === 'fulfilled' && !value.has)

      //   await Promise.allSettled(promises.map(({ value }) => this.getAndPutBlock(value.address)))
      // }

      const localBlock = await this.lastBlock
      const localIndex = localBlock ? Number(localBlock.index) : -1
      const remoteIndex = Number(lastBlock.index)
      const remoteBlockHash = lastBlock.hash

      // Get the local state hash from chainStore
      let localStateHash = '0x0'
      try {
        localStateHash = new TextDecoder().decode(await globalThis.chainStore.get('lastBlock'))
      } catch (error) {
        debug(`No local state hash found: ${error}`)
      }

      debug(`Local block height: ${localIndex}, remote block height: ${remoteIndex}`)
      debug(`Local state hash: ${localStateHash}, remote block hash: ${remoteBlockHash}`)

      // Skip syncing if remote block hash is 0x0 (invalid state)
      if (remoteBlockHash === '0x0') {
        debug(`Remote block hash is 0x0, skipping sync`)
        return
      }

      // Skip if local machine is already ahead of remote; also guard against DoS via deep reorgs
      if (localIndex > remoteIndex) {
        const MAX_REORG_DEPTH = 6
        const reorgDepth = localIndex - remoteIndex
        if (reorgDepth > MAX_REORG_DEPTH) {
          console.warn(
            `[consensus-safety] Peer proposing reorg depth of ${reorgDepth} blocks ` +
              `(limit is ${MAX_REORG_DEPTH}). Rejecting to prevent DoS.`
          )
          throw new Error(`Excessive reorg depth: ${reorgDepth} blocks (max ${MAX_REORG_DEPTH})`)
        }
        debug(`Local index ${localIndex} is ahead of remote ${remoteIndex}, skipping sync`)
        return
      }

      // Use state hash comparison: only resolve if remote hash differs from local state hash
      if (localStateHash !== remoteBlockHash) {
        if (this.wantList.length > 0) {
          debug(`Fetching ${this.wantList.length} blocks before resolving`)
          const getBatch = async (batch) => {
            const blocks = await Promise.all(
              batch.map((hash) =>
                this.getAndPutBlock(hash).catch((e) => {
                  console.warn(`failed to fetch block ${hash}`, e)
                })
              )
            )

            const transactions = blocks.filter((block) => Boolean(block)).flatMap((block) => block.decoded.transactions)
            return this.#resolveTransactions(transactions)
          }

          // Process in batches of 50 to avoid overwhelming network/memory
          for (let i = 0; i < this.wantList.length; i += 50) {
            const batch = this.wantList.slice(i, i + 50)
            await getBatch(batch)
          }
        }
        // Remote block hash differs from our local state, need to resolve
        debug(`Resolving remote block: ${remoteBlockHash} @${remoteIndex} (differs from local state)`)

        // if we have everything locally, we can load it
        // if (blocksSynced > 0 && blocksSynced < 1000) {
        //   const promises = []
        //   for (let i = 0; i < blocksSynced; i++) {
        //     promises.push(this.resolveBlock(remoteBlockHash))
        //   }
        //   await Promise.all(promises)
        // } else {
        await this.resolveBlock(remoteBlockHash)
        // }

        const blocksSynced = remoteIndex - localIndex
        debug(`Resolved ${blocksSynced} new block(s)`)
        const blocks = this.#blocks

        debug(`Loading blocks from index ${localIndex + 1} to ${remoteIndex}`)
        const start = localIndex + 1
        if (this.#machine && blocks.length > start) {
          await this.#loadBlocks(blocks.slice(start))
        }

        // Update state with the latest block
        if (blocks.length > 0) {
          await this.updateState(new BlockMessage(blocks[blocks.length - 1]))
        }
      } else {
        debug(`Block already in local state. Remote hash: ${remoteBlockHash} matches local state`)
      }
    } catch (error) {
      console.log(error)

      throw error
    }
  }

  async #getLatestBlock() {
    let promises = []
    const connectedPeers = Object.values(globalThis.peernet.connections || {}).filter((peer) => peer.connected)
    let compatiblePeerCount = 0

    let data = await new globalThis.peernet.protos['peernet-request']({
      request: 'lastBlock'
    })
    let node = await globalThis.peernet.prepareMessage(data)

    for (const id in globalThis.peernet.connections) {
      // @ts-ignore
      const peer = globalThis.peernet.connections[id]
      if (peer.connected && this.isVersionCompatible(peer.version)) {
        compatiblePeerCount += 1
        const task = async () => {
          try {
            let result = await peer.request(node.encoded)
            const resultType = result instanceof Uint8Array ? `bytes:${result.length}` : typeof result
            debug(`lastBlock result type: ${resultType}`)
            console.log({ result })
            if (result instanceof Uint8Array) {
              for (let i = 0; i < 3; i += 1) {
                try {
                  const wrapped = await new globalThis.peernet.protos['peernet-response'](result)
                  if (wrapped?.decoded?.response === undefined) break
                  result = wrapped.decoded.response
                } catch {
                  break
                }
              }
            }
            return { result, peer }
          } catch (error) {
            const peerId = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || 'unknown'
            debug(`lastBlock request failed: ${peerId}:`, (error as Error)?.message ?? error)
            throw error
          }
        }
        promises.push(task())
      }
    }

    if (connectedPeers.length > 0 && compatiblePeerCount === 0) {
      throw new ResolveError(
        `latestBlock: no compatible peers found for local version ${this.version} among ${connectedPeers.length} connected peers`
      )
    }

    // @ts-ignore
    console.log({ promises })
    promises = (await this.promiseRequests(promises)) as any[]

    if (compatiblePeerCount > 0 && promises.length === 0) {
      throw new ResolveError('latestBlock: no responses from compatible peers')
    }

    console.log({ promises })
    promises = await Promise.all(
      promises.map(async (item) => ({
        value: (await this.#resolveLastBlockMessage(item.value)).decoded,
        peer: item.peer
      }))
    )

    let latest = { index: 0, hash: '0x0', previousHash: '0x0' }

    promises = promises.sort((a, b) => Number(b.value.index) - Number(a.value.index))

    if (promises.length > 0) latest = promises[0].value
    debug(`Latest block from peers: ${latest.hash} @${latest.index}`)
    if (latest.hash && latest.hash !== '0x0') {
      let message = await globalThis.peernet.get(latest.hash, 'block')
      message = await new BlockMessage(message)
      const hash = await message.hash()
      if (hash !== latest.hash) throw new Error('invalid block @getLatestBlock')

      latest = { ...message.decoded, hash }

      const peer = promises[0].peer

      if (peer.connected && this.isVersionCompatible(peer.version)) {
        let data = await new globalThis.peernet.protos['peernet-request']({
          request: 'knownBlocks'
        })
        let node = await globalThis.peernet.prepareMessage(data)
        try {
          let message = await peer.request(node.encoded)
          message = await new globalThis.peernet.protos['peernet-response'](message)
          const MAX_WANTLIST_SIZE = 1000
          const incoming = message.decoded.response.blocks.filter((block) => !this.knownBlocks.includes(block))
          const remaining = MAX_WANTLIST_SIZE - this.wantList.length
          if (remaining > 0) this.wantList.push(...incoming.slice(0, remaining))
        } catch (error) {
          const peerId = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || 'unknown'
          debug(`knownBlocks request failed: ${peerId}:`, (error as Error)?.message ?? error)
          throw error
        }
      }
    }
    return latest
  }

  #loadBlockTransactions = (transactions): Promise<TransactionMessage[]> =>
    Promise.all(
      transactions.map(async (transaction) => new TransactionMessage(await peernet.get(transaction, 'transaction')))
    )

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
    if (blocks.some((block) => !block)) {
      throw new Error('missing block data during load; chain resolution incomplete')
    }
    const poolTransactionKeys = new Set(await globalThis.transactionPoolStore.keys())
    debug(`pool transactions: ${poolTransactionKeys.size}`)
    debug(`loading ${blocks.length} blocks`)
    for (const block of blocks) {
      if (block && !block.loaded) {
        try {
          debug(`loading block: ${Number(block.index)} ${(block as any).hash}`)
          let transactions = await this.#loadBlockTransactions(block.transactions || [])
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
            if (poolTransactionKeys.has(hash)) await globalThis.transactionPoolStore.delete(hash)
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
          debug(`loaded block: ${(block as any).hash} @${Number(block.index)}`)
          globalThis.pubsub.publish('block-loaded', { ...block })
        } catch (error) {
          console.error(error)
          for (const transaction of block.transactions) {
            this.wantList.push(transaction as unknown as string)
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
      console.log({ promises })
      promises = await Promise.allSettled(promises)
      console.log({ promises })
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

    // Check if we have any connected peers with the same version
    const compatiblePeers = Object.values(globalThis.peernet.connections || {}).filter(
      (peer) => peer.connected && this.isVersionCompatible(peer.version)
    )

    if (compatiblePeers.length === 0) {
      debug('No compatible peers available for sync')
      return false
    }

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

  async #waitForPeers(timeoutMs = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const checkPeers = () => {
        const peers = Object.values(globalThis.peernet.connections || {}).filter(
          (peer) => peer.connected && this.isVersionCompatible(peer.version)
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
      const machine = new Machine(this.#blocks)
      console.log(machine)

      await machine.ready
      this.#machine = machine
    }
  }
}

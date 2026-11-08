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
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { readCheckpoint, recoveryHistory, restoreAccountNonces } from './helpers/state-checkpoint.js'
import Jobber from './jobs/jobber.js'
import { BlockHash, BlockInMemory, RawBlock } from './types.js'
import { ResolveError } from '@leofcoin/errors'
import { resolveLastBlockMessage } from './helpers/last-block.js'
import { decodeResponsePayload } from './helpers/response.js'
import { CanonicalStateQueue, type CanonicalTransition } from './consensus/canonical-state-queue.js'
import { validateChainLink } from './consensus/chain-link.js'
import { resolveTransactionReference } from './consensus/transaction-reference.js'
import { publishObserverEvent } from './observer-events.js'

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
  #canonicalStateQueue = new CanonicalStateQueue()

  protected withCanonicalState<T>(operation: (transition: CanonicalTransition) => Promise<T>): Promise<T> {
    return this.#canonicalStateQueue.run(operation).catch(error => {
      if (this.#canonicalStateQueue.failed) {
        this.#loaded = false
        this.#syncState = 'errored'
      }
      throw error
    })
  }

  protected canonicalTip() {
    // Status reads may fall back to a snapshot; financial decisions must not.
    return this.#machine
      ? this.#machine.getCanonicalTip()
      : Promise.resolve({ index: -1, hash: '0x0', previousHash: '0x0' })
  }

  #loaded: boolean = false
  jobber: Jobber
  #resolvingHashes = new Map<string, Promise<void>>()

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
    this.jobber = new Jobber(this.resolveTimeout)
    await globalThis.peernet.addRequestHandler('lastBlock', this.#lastBlockHandler)
    await globalThis.peernet.addRequestHandler('knownBlocks', this.#knownBlocksHandler)
    await globalThis.peernet.addRequestHandler('chainState', this.#chainStateHandler)
    try {
      const identity = await createChainIdentity(globalThis.peernet?.network || 'leofcoin:peach', addresses)
      const required = [addresses.contractFactory, addresses.nativeToken, addresses.nameService, addresses.validators]
      const checkpoint = await readCheckpoint(globalThis.stateStore, identity.chainId, required)
      const checkpointTip = checkpoint?.snapshot.lastBlock ?? { index: -1, hash: '0x0' }
      const marker = await globalThis.chainStore.has('lastBlock')
        ? new TextDecoder().decode(await globalThis.chainStore.get('lastBlock')) : '0x0'
      const readBlock = async hash => await globalThis.blockStore.has(hash)
        ? globalThis.blockStore.get(hash) : globalThis.peernet.get(hash, 'block')
      let history = await recoveryHistory(checkpointTip.hash, readBlock)
      if (marker !== '0x0' && marker !== checkpointTip.hash && !history.some(block => block.hash === marker)) {
        const candidate = await recoveryHistory(marker, readBlock)
        if (checkpointTip.hash !== '0x0' && candidate[Number(checkpointTip.index)]?.hash !== checkpointTip.hash)
          throw new Error('Persisted chain marker conflicts with state checkpoint')
        history = candidate
      }
      // Legacy split snapshots are deliberately ignored. The referenced canonical
      // blocks are revalidated and replayed from genesis instead of trusting a
      // possibly mixed lastBlock/states/accounts/info generation.
      if (!checkpoint && await globalThis.stateStore.has('lastBlock')) {
        const legacy = JSON.parse(new TextDecoder().decode(await globalThis.stateStore.get('lastBlock')))
        if (legacy.hash && legacy.hash !== '0x0' && legacy.hash !== history.at(-1)?.hash) {
          const candidate = await recoveryHistory(legacy.hash, readBlock)
          const common = Math.min(history.length, candidate.length)
          if (common && history[common - 1].hash !== candidate[common - 1].hash)
            throw new Error('Legacy snapshot conflicts with canonical chain marker')
          if (candidate.length > history.length) history = candidate
        }
      }
      if (await globalThis.chainStore.has('recoveryTarget')) {
        const target = new TextDecoder().decode(await globalThis.chainStore.get('recoveryTarget'))
        const candidate = await recoveryHistory(target, readBlock)
        const common = Math.min(history.length, candidate.length)
        if (common && history[common - 1].hash !== candidate[common - 1].hash) {
          const checkpointCommon = Math.min(Number(checkpointTip.index) + 1, candidate.length)
          if (!checkpointCommon || history[checkpointCommon - 1].hash === candidate[checkpointCommon - 1].hash)
            throw new Error(`Recovery target ${target} conflicts with uncheckpointed canonical history; preserve this data root`)
          // A speculative target cannot replace an already committed checkpoint.
          // Keep the marker until canonical recovery has completed successfully.
          console.warn(`[recovery] ignoring conflicting recoveryTarget ${target}; preserving committed checkpoint ${checkpointTip.hash}`)
        } else if (candidate.length > history.length) {
          history = candidate
        }
      }
      this.#blocks = history
      this.#blockHashMap = new Map(history.map(block => [block.hash, block.index]))
      this.knownBlocks = await globalThis.blockStore.keys()
      if (!checkpoint && !history.length && this.knownBlocks.length)
        throw new Error('Local blocks exist without a canonical recovery anchor; preserve this root and rebuild in a separate root')
      const prefix = history.slice(0, Number(checkpointTip.index) + 1).map(block => ({ ...block, loaded: true }))
      if (history.length > prefix.length) await globalThis.chainStore.put('recoveryTarget', history.at(-1).hash)
      const machine = new Machine(prefix, checkpoint)
      await machine.ready
      this.#machine = machine
      await restoreAccountNonces(globalThis.accountsStore, checkpoint?.snapshot.accounts ?? {})
      for (const block of prefix) this.#blocks[Number(block.index)].loaded = true
      await this.withCanonicalState(transition => this.#loadBlocks(history.slice(prefix.length), transition))
      if (!checkpoint && !history.length) await this.#machine.updateState(true)
      const tip = await this.canonicalTip()
      await globalThis.chainStore.put('lastBlock', tip.hash)
      // A fresh node has no recovery marker. OPFS throws NotFoundError when
      // deleting an absent file, unlike LevelDB's idempotent delete.
      if (await globalThis.chainStore.has('recoveryTarget')) await globalThis.chainStore.delete('recoveryTarget')
      this.#loaded = true
      this.#chainState = 'loaded'
    } catch (error) {
      this.#loaded = false
      this.#chainState = 'loading'
      this.#syncState = 'errored'
      throw error
    }
  }

  async updateState(message: BlockMessage) {
    if (!this.#machine) throw new Error('Cannot checkpoint an uninitialized state machine')
    const hash = await message.hash()
    const tip = await this.canonicalTip()
    if (tip.hash !== hash || Number(tip.index) !== Number(message.decoded.index))
      throw new Error('Checkpoint target does not match canonical worker tip')
    await this.#machine.updateState(true)
    await globalThis.chainStore.put('lastBlock', hash)
    if (await globalThis.chainStore.has('recoveryTarget') &&
      new TextDecoder().decode(await globalThis.chainStore.get('recoveryTarget')) === hash)
      await globalThis.chainStore.delete('recoveryTarget')
    publishObserverEvent(globalThis.pubsub, 'lastBlock', message.encoded)
  }

  getLatestBlock(): Promise<BlockMessage['decoded']> {
    // @ts-ignore
    return this.#getLatestBlock()
  }

  async getAndPutBlock(hash: string): Promise<BlockMessage> {
    let block = await globalThis.peernet.get(hash, 'block')
    if (block === undefined || block === null) {
      throw new ResolveError(`block data unavailable for ${hash}`)
    }

    if (!(block instanceof Uint8Array)) block = new Uint8Array(Object.values(block))
    block = await new BlockMessage(block)

    const resolvedHash = await block.hash()
    if (resolvedHash !== hash)
      throw new ResolveError(`block hash mismatch: requested ${hash}, received ${resolvedHash}`)

    const { index } = block.decoded
    if (this.#blocks[index] && this.#blocks[index].hash !== resolvedHash) {
      throw new ResolveError(`conflicting block ${resolvedHash} @${index}`)
    }
    if (!(await globalThis.peernet.has(hash))) await globalThis.peernet.put(hash, block.encoded, 'block')
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
            const transaction = await resolveTransactionReference(hash, data)
            await transactionStore.put(hash, transaction.encoded)
          }
        })
    )
  }

  async #resolveBlock(hash) {
    const localHash = (await this.canonicalTip()).hash
    const visited = new Set<string>()
    while (hash !== '0x0' && hash !== localHash) {
      if (visited.has(hash)) throw new ResolveError(`cyclic block ancestry at ${hash}`)
      visited.add(hash)
      const cachedIndex = this.#blockHashMap.get(hash)
      const cached = this.#blocks[cachedIndex]
      if (cached) {
        hash = cached.previousHash
        continue
      }
      try {
        const block = await this.getAndPutBlock(hash)
        // Finish one block's dependencies before fetching its parent. A long
        // cold-sync must not create one concurrent request per historical block.
        await this.#resolveTransactions(block.decoded.transactions as unknown as string[])
        const index = block.decoded.index
        const size = block.encoded.byteLength
        this.#totalSize += size
        this.#blocks[index] = { hash, ...block.decoded }
        this.#blockHashMap.set(hash, index)
        debug(`resolved block: ${hash} @${index} ${formatBytes(size)}`)
        publishObserverEvent(globalThis.pubsub, 'block-resolved', { hash, index })
        this.#lastResolved = this.#blocks[index]
        this.#lastResolvedTime = Date.now()
        hash = block.decoded.previousHash
      } catch (error) {
        throw new ResolveError(`block: ${hash}`, { cause: error })
      }
    }
  }

  async resolveBlock(hash) {
    if (!hash) throw new Error(`expected hash, got: ${hash}`)
    if (hash === '0x0') return
    const existing = this.#resolvingHashes.get(hash)
    if (existing) return existing
    this.#resolving = true
    const resolution = Promise.resolve().then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.#resolveBlock(hash)
          this.#resolveErrored = false
          return
        } catch (error) {
          console.error(`block resolution attempt ${attempt + 1} failed for ${hash}`, error)
          if (attempt === 2) {
            if (!this.wantList.includes(hash)) this.wantList.push(hash)
            throw new ResolveError(`block: ${hash}`, { cause: error })
          }
        }
      }
    }).finally(() => {
      this.#resolvingHashes.delete(hash)
      if (this.#resolvingHashes.size === 0) this.#resolving = false
    })
    this.#resolvingHashes.set(hash, resolution)
    return resolution
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
      const latest = await this.#getLatestBlock()
      const result = await this.syncChain(latest)
      if (result === 'errored') throw new ResolveError('Canonical chain restoration failed')
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

    if (globalThis.peernet.peers.length === 0) {
      this.#chainSyncing = false
      this.#syncState = 'connectionless'
      return this.#syncState
    }

    try {
      await this.withCanonicalState((transition) => this.#syncChain(lastBlock, transition))
    } catch (error) {
      this.#syncErrorCount += 1
      this.#chainSyncing = false
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

  async #syncChain(lastBlock, transition: CanonicalTransition) {
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

      const localBlock = await this.canonicalTip()
      const localIndex = localBlock ? Number(localBlock.index) : -1
      const remoteIndex = Number(lastBlock.index)
      const remoteBlockHash = lastBlock.hash

      publishObserverEvent(globalThis.pubsub, 'sync-progress', {
        phase: 'syncing',
        startIndex: localIndex,
        localIndex,
        targetIndex: remoteIndex
      })

      const localStateHash = localBlock.hash

      debug(`Local block height: ${localIndex}, remote block height: ${remoteIndex}`)
      debug(`Local state hash: ${localStateHash}, remote block hash: ${remoteBlockHash}`)

      // Skip syncing if remote block hash is 0x0 (invalid state)
      if (remoteBlockHash === '0x0') {
        debug(`Remote block hash is 0x0, skipping sync`)
        return
      }

      if (localBlock?.hash !== '0x0' && localIndex === remoteIndex && localBlock.hash !== remoteBlockHash) {
        throw new Error(`Block conflict detected at index ${remoteIndex}`)
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
        // Remote block hash differs from our local state, need to resolve
        debug(`Resolving remote block: ${remoteBlockHash} @${remoteIndex} (differs from local state)`)

        const suffix = await recoveryHistory(remoteBlockHash, async (hash: string) =>
          await globalThis.blockStore.has(hash)
            ? globalThis.blockStore.get(hash)
            : globalThis.peernet.get(hash, 'block'), localBlock)
        const target = suffix.at(-1)
        if (!target || Number(target.index) !== remoteIndex)
          throw new Error(`Sync target height does not match block ${remoteBlockHash} at index ${remoteIndex}`)
        // Resolve and persist only a hash-checked extension before installing its
        // recovery marker. Rejected peer forks must not poison future restarts.
        await this.resolveBlock(remoteBlockHash)
        for (const block of suffix) {
          await globalThis.blockStore.put(block.hash, new BlockMessage(block).encoded)
        }
        await globalThis.chainStore.put('recoveryTarget', remoteBlockHash)

        const blocksSynced = remoteIndex - localIndex
        debug(`Resolved ${blocksSynced} new block(s)`)
        debug(`Loading blocks from index ${localIndex + 1} to ${remoteIndex}`)
        await this.#loadBlocks(this.#blocks.slice(localIndex + 1, remoteIndex + 1), transition)

        // Update state with the latest block
        const appliedTip = await this.canonicalTip()
        if (appliedTip.hash !== remoteBlockHash || Number(appliedTip.index) !== remoteIndex) {
          throw new Error(`Sync did not apply canonical target ${remoteBlockHash} at index ${remoteIndex}`)
        }
        transition.markMutating()
        await this.updateState(new BlockMessage(target))
      } else {
        debug(`Block already in local state. Remote hash: ${remoteBlockHash} matches local state`)
      }

      publishObserverEvent(globalThis.pubsub, 'sync-progress', {
        phase: 'synced',
        startIndex: localIndex,
        localIndex: remoteIndex,
        targetIndex: remoteIndex
      })
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
            const result = await peer.request(node.encoded)
            const resultType = result instanceof Uint8Array ? `bytes:${result.length}` : typeof result
            debug(`lastBlock result type: ${resultType}`)
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
        value: (await resolveLastBlockMessage(item.value)).decoded,
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
          const message = await decodeResponsePayload(await peer.request(node.encoded))
          const blocks = (message as any)?.blocks
          if (!Array.isArray(blocks)) throw new Error('knownBlocks response does not contain a blocks array')
          const MAX_WANTLIST_SIZE = 1000
          const incoming = blocks.filter((block) => !this.knownBlocks.includes(block))
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

  protected async applyRecoveredBlock(block: BlockMessage, transition: CanonicalTransition): Promise<void> {
    throw new Error('Canonical block application is not implemented')
  }

  async #loadBlocks(blocks: BlockInMemory[], transition: CanonicalTransition): Promise<boolean> {
    this.#chainState = 'loading'
    for (const block of blocks) {
      if (!block) throw new Error('Missing block data during recovery')
      if (block.loaded) continue
      const { hash, loaded, ...header } = block
      const message = new BlockMessage(header)
      if (await message.hash() !== block.hash) throw new Error('Recovery block hash changed before application')
      await this.applyRecoveredBlock(message, transition)
      const tip = await this.canonicalTip()
      if (tip.hash !== block.hash || Number(tip.index) !== Number(block.index))
        throw new Error('Recovery did not apply the expected canonical block')
      block.loaded = true
      publishObserverEvent(globalThis.pubsub, 'block-loaded', { ...block })
    }
    this.#chainState = 'loaded'
    return true
  }

  async promiseRequests(promises) {
    let timeout
    const settled = await Promise.race([
      Promise.allSettled(promises),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), this.requestTimeout)
      })
    ])
    clearTimeout(timeout)

    if (settled === null) {
      debug('sync timed out')
      return []
    }

    return settled
      .filter(({ status }) => status === 'fulfilled')
      .map(({ value }) => ({ value: value.result, peer: value.peer }))
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
    if (!this.#machine) throw new Error('Restart the node to initialize recovery')
    const tip = await this.canonicalTip()
    return this.withCanonicalState(transition => this.#loadBlocks(this.#blocks.slice(Number(tip.index) + 1), transition))
  }
}

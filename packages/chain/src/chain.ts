import { createDebugger } from '@vandeurenglenn/debug'
import { formatUnits, parseUnits, formatBytes } from '@leofcoin/utils'
import {
  ContractMessage,
  TransactionMessage,
  BlockMessage,
  BWMessage,
  BWRequestMessage,
  LastBlockMessage,
  StateMessage,
  PrevoteMessage,
  PrecommitMessage,
  ProposalMessage
} from '@leofcoin/messages'
import addresses from '@leofcoin/addresses'
import {
  signTransaction,
  contractFactoryMessage,
  nativeTokenMessage,
  validatorsMessage,
  nameServiceMessage,
  calculateFee
} from '@leofcoin/lib'
import { VersionControl } from './version-control.js'
import ConnectionMonitor from './connection-monitor.js'
import { log } from 'node:console'

const debug = createDebugger('leofcoin/chain')

// check if browser or local
export default class Chain extends VersionControl {
  #state

  #slotTime = 10000
  #blockTime = 6000 // 6 second target block time
  #epochLength = 10 // Blocks per epoch (enables block-based epoch boundaries)
  id
  utils = {}
  /** {Address[]} */
  #validators = []

  /** {Boolean} */
  #runningEpoch = false

  /** Block height at which current epoch started (for block-based epoch timing) */
  #currentEpochStartHeight: number = 0

  /** {Object} Block cache by index for conflict detection: {index: {hash, ...block}} */
  #blocks: Record<number, any> = {}

  #participants = []
  #participating = false
  #jail: Set<string> = new Set()
  #jailReleaseTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  #peerConnectionRetries = new Map()
  #maxPeerRetries = 5
  #peerRetryDelay = 5000
  /** {Map} Peer reputation tracking: {peerId: {score, failures}} */
  #peerReputations: Map<string, { score: number; failures: string[] }> = new Map()
  #minPeerScore = -10
  #maxPeerFailures = 100

  // ── Tendermint consensus state ──────────────────────────────────────────────
  /** Current consensus round (increments when proposer is unresponsive) */
  #consensusRound: number = 0
  /** Timer that advances #consensusRound when the proposer doesn't propose in time */
  #roundTimer: ReturnType<typeof setTimeout> | null = null
  /** prevotes collected per `height:round:blockHash` key */
  #prevotes: Map<string, Set<string>> = new Map()
  /** precommits collected per `height:round:blockHash` key */
  #precommits: Map<string, Set<string>> = new Map()
  /** Index of the last block that reached 2f+1 precommits */
  #committedHeight: number = -1
  /** Prevents casting duplicate prevote/precommit per height:round */
  #castedVotes: Set<string> = new Set()
  // ────────────────────────────────────────────────────────────────────────────

  #connectionMonitor: ConnectionMonitor
  readyResolve: (value: boolean | PromiseLike<boolean>) => void
  ready = new Promise<boolean>((resolve) => {
    this.readyResolve = resolve
  })

  constructor(config) {
    super(config)
    this.#init()
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

  #sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  async #recordPeerFailure(peerId: string, reason: string) {
    if (!this.#peerReputations.has(peerId)) {
      this.#peerReputations.set(peerId, { score: 0, failures: [] })
    }
    const rep = this.#peerReputations.get(peerId)!
    rep.score -= 1
    rep.failures.push(`${Date.now()}: ${reason}`)

    if (rep.failures.length > this.#maxPeerFailures) {
      rep.failures.shift()
    }

    if (rep.score < this.#minPeerScore) {
      console.warn(`[peer-ban] Peer ${peerId} banned after ${rep.failures.length} failures`)
      // Disconnect and don't reconnect
      try {
        await globalThis.peernet.disconnect(peerId)
      } catch (e) {
        debug(`Failed to disconnect peer ${peerId}`)
      }
    }
  }

  #isJailed(address?: string): boolean {
    return typeof address === 'string' && this.#jail.has(address)
  }

  async #getConsensusValidators(nextBlockIndex?: number): Promise<string[]> {
    const localBlock = await this.lastBlock
    const localIndex = localBlock?.index !== undefined ? Number(localBlock.index) : -1

    if (
      Array.isArray(localBlock?.validators) &&
      localBlock.validators.length > 0 &&
      (nextBlockIndex === undefined || nextBlockIndex === localIndex + 1)
    ) {
      return [
        ...new Set(
          localBlock.validators
            .map((validator: { address: string }) => validator.address)
            .filter((address: string) => Boolean(address))
        )
      ].sort()
    }

    const validators = (await this.staticCall(addresses.validators, 'validators')) as string[]
    return [...new Set(validators)].sort()
  }

  #validateBlockValidators(blockMessage: BlockMessage): void {
    const validators = blockMessage.decoded.validators || []

    if (!Array.isArray(validators) || validators.length === 0) {
      throw new Error(`Block ${blockMessage.decoded.index} does not include validators`)
    }

    // Validate protocol version compatibility
    if (!blockMessage.decoded.protocolVersion || typeof blockMessage.decoded.protocolVersion !== 'string') {
      throw new Error(`Block ${blockMessage.decoded.index} does not have a valid protocolVersion field`)
    }

    if (!this.isVersionCompatible(blockMessage.decoded.protocolVersion)) {
      throw new Error(
        `Block ${blockMessage.decoded.index} uses incompatible protocol version: ${blockMessage.decoded.protocolVersion} ` +
          `(local: ${this.version}). Major.minor version must match.`
      )
    }

    // Validate producer field
    if (!blockMessage.decoded.producer || typeof blockMessage.decoded.producer !== 'string') {
      throw new Error(`Block ${blockMessage.decoded.index} does not have a valid producer field`)
    }

    // Validate producerProof field
    if (!blockMessage.decoded.producerProof || typeof blockMessage.decoded.producerProof !== 'string') {
      throw new Error(`Block ${blockMessage.decoded.index} does not have a valid producerProof field`)
    }

    // Verify producer is in validators list
    const producerIsValidator = validators.some((v) => v.address === blockMessage.decoded.producer)
    if (!producerIsValidator) {
      throw new Error(
        `Block ${blockMessage.decoded.index} producer ${blockMessage.decoded.producer} is not in validators list`
      )
    }

    const addresses = validators.map((validator) => validator.address)
    if (addresses.some((address) => typeof address !== 'string' || address.length === 0)) {
      throw new Error(`Block ${blockMessage.decoded.index} includes an invalid validator address`)
    }

    const canonicalAddresses = [...addresses].sort()
    if (canonicalAddresses.some((address, index) => address !== addresses[index])) {
      throw new Error(`Block ${blockMessage.decoded.index} validators are not canonically sorted`)
    }

    if (new Set(addresses).size !== addresses.length) {
      throw new Error(`Block ${blockMessage.decoded.index} validators contain duplicates`)
    }

    const validatorCount = BigInt(validators.length)
    const expectedReward = blockMessage.decoded.fees / validatorCount + blockMessage.decoded.reward / validatorCount

    for (const validator of validators) {
      if (validator.reward !== expectedReward) {
        throw new Error(
          `Block ${blockMessage.decoded.index} has an invalid reward for validator ${validator.address}: ` +
            `expected ${expectedReward}, got ${validator.reward}`
        )
      }
    }
  }

  /** Check if the next block will cross an epoch boundary (block-based timing) */
  #isEpochBoundary(blockHeight: number): boolean {
    return (blockHeight + 1) % this.#epochLength === 0
  }

  /** Handle epoch transition when a block crosses epoch boundary */
  async #handleEpochBoundary(blockHeight: number): Promise<void> {
    if (!this.#isEpochBoundary(blockHeight)) return

    // Epoch boundary crossed: update epoch start, reset round, trigger validator rotation
    this.#currentEpochStartHeight = blockHeight + 1
    this.#consensusRound = 0

    debug(
      `[consensus] Epoch boundary at block ${blockHeight}: new epoch starts at height ${this.#currentEpochStartHeight}`
    )

    // If we're participating as a validator, trigger immediate epoch to determine new proposer
    if (this.#participating && !this.#runningEpoch) {
      await this.#runEpoch()
    }
  }

  async #runEpoch(): Promise<void> {
    if (this.#runningEpoch) return
    this.#runningEpoch = true
    console.log('epoch')
    const validators = await this.#getConsensusValidators()
    console.log({ validators })

    if (this.#isJailed(peernet.selectedAccount)) {
      this.#runningEpoch = false
      return
    }

    if (!validators.includes(peernet.selectedAccount)) {
      this.#runningEpoch = false
      return
    }

    // Phase 1: Deterministic proposer selection
    // proposer = validators[(nextBlockIndex + round) % validators.length]
    const localBlock = await this.lastBlock
    const nextIndex = (localBlock?.index !== undefined ? Number(localBlock.index) : -1) + 1
    const proposerIdx = (nextIndex + this.#consensusRound) % validators.length
    const isProposer = validators[proposerIdx] === peernet.selectedAccount

    if (!isProposer) {
      // Non-proposer: start round-advance timer in case proposer is unresponsive
      if (!this.#roundTimer) {
        this.#roundTimer = setTimeout(async () => {
          this.#roundTimer = null
          this.#consensusRound++
          debug(`[consensus] Round timed out, advancing to round ${this.#consensusRound}`)
          this.#runningEpoch = false
          if (this.#participating) await this.#runEpoch()
        }, this.#slotTime)
      }
      this.#runningEpoch = false
      return
    }

    // We are the proposer — clear any stale round-advance timer
    if (this.#roundTimer) {
      clearTimeout(this.#roundTimer)
      this.#roundTimer = null
    }

    const start = Date.now()

    try {
      await this.#createBlock()
    } catch (error) {
      console.error(error)
    }

    const end = Date.now()
    console.log((end - start) / 1000 + ' s')

    // enforce target block time to avoid tight loops
    const elapsed = end - start
    const remaining = this.#blockTime - elapsed
    const hasMore = await this.hasTransactionToHandle()
    // Only delay if there's no backlog; if backlog exists, continue immediately
    if (!hasMore && remaining > 0) await this.#sleep(remaining)

    this.#runningEpoch = false
    if (hasMore) return this.#runEpoch()
  }

  async #setup() {
    const contracts = [
      {
        address: addresses.contractFactory,
        message: contractFactoryMessage
      },
      {
        address: addresses.nativeToken,
        message: nativeTokenMessage
      },
      {
        address: addresses.validators,
        message: validatorsMessage
      },
      {
        address: addresses.nameService,
        message: nameServiceMessage
      }
    ]

    await Promise.all(
      contracts.map(async ({ address, message }) => {
        // @ts-ignore
        message = await new ContractMessage(Uint8Array.from(message.split(',').map((string) => Number(string))))
        // @ts-ignore
        await globalThis.contractStore.put(address, message.encoded as ContractMessage['encoded'])
      })
    )
    console.log('handle native contracts')
    // handle native contracts
  }

  async #init() {
    // this.node = await new Node()
    this.#participants = []
    this.#participating = false
    this.#connectionMonitor = new ConnectionMonitor()
    log('[chain] init:start')

    const initialized = await globalThis.contractStore.has(addresses.contractFactory)
    log(`chain initialized: ${initialized}`)
    if (!initialized) await this.#setup()

    this.utils = { formatUnits, parseUnits }

    // this.#state = new State()
    console.log('init')

    // todo some functions rely on state
    await super.init()
    log('super init done')
    // Start connection monitoring
    this.#connectionMonitor.start(this.version)

    await globalThis.peernet.addRequestHandler('bw-request-message', () => {
      const bw = (globalThis.peernet.client as any)?.bw || { up: 0, down: 0 }
      return new BWMessage(bw)
    })

    // await globalThis.peernet.addRequestHandler('peerId', () => {
    //   let node =
    //   globalThis.peernet.protos['peernet-response']({response: node.encoded})
    // })

    await globalThis.peernet.addRequestHandler('transactionPool', this.#transactionPoolHandler.bind(this))
    await globalThis.peernet.addRequestHandler('version', this.#versionHandler.bind(this))
    await globalThis.peernet.addRequestHandler('stateInfo', () => {
      return new globalThis.peernet.protos['peernet-response']({
        response: new StateMessage(this.machine.states.info).encoded
      })
    })

    globalThis.peernet.subscribe('add-block', this.#addBlock.bind(this))

    globalThis.peernet.subscribe('invalid-transaction', this.#invalidTransaction.bind(this))

    globalThis.peernet.subscribe('send-transaction', this.#sendTransaction.bind(this))

    globalThis.peernet.subscribe('add-transaction', this.#addTransaction.bind(this))

    globalThis.peernet.subscribe('validator:timeout', this.#validatorTimeout.bind(this))

    // Tendermint consensus topics
    globalThis.peernet.subscribe('consensus:propose', this.#handleProposal.bind(this))
    globalThis.peernet.subscribe('consensus:prevote', this.#handlePrevote.bind(this))
    globalThis.peernet.subscribe('consensus:precommit', this.#handlePrecommit.bind(this))

    globalThis.pubsub.subscribe('peer:connected', this.#peerConnected.bind(this))

    globalThis.pubsub.publish('chain:ready', true)

    console.log('[chain] init:done')
    this.readyResolve(true)
  }

  async #invalidTransaction(hash) {
    hash = new TextDecoder().decode(hash)
    if (!(await globalThis.transactionPoolStore.has(hash))) {
      debug(`transaction ${hash} not in pool`)
      return
    }
    console.log(`removing invalid transaction: ${hash}`)
    await globalThis.transactionPoolStore.delete(hash)
  }

  async #validatorTimeout(validatorInfo: { address?: string; timeout?: number }): Promise<void> {
    const address = validatorInfo?.address
    if (!address) return

    const timeout = Math.min(Math.max(Number(validatorInfo.timeout) || 0, 0), 60 * 60 * 1000)
    const existingRelease = this.#jailReleaseTimers.get(address)
    if (existingRelease) clearTimeout(existingRelease)

    this.#jail.add(address)
    const releaseTimer = setTimeout(() => {
      this.#jail.delete(address)
      this.#jailReleaseTimers.delete(address)
    }, timeout)

    this.#jailReleaseTimers.set(address, releaseTimer)
  }

  // ── Tendermint consensus handlers ────────────────────────────────────────

  /**
   * Publish a prevote or precommit.  Idempotent — will not cast the same
   * vote twice for the same height:round.
   */
  #castVote = async (type: 'prevote' | 'precommit', blockHash: string, index: number, round: number) => {
    const voteKey = `${type}:${index}:${round}`
    if (this.#castedVotes.has(voteKey)) return
    this.#castedVotes.add(voteKey)

    const from = peernet.selectedAccount
    const voteData = { blockHash, index: BigInt(index), round: BigInt(round), from }
    const Message = type === 'prevote' ? PrevoteMessage : PrecommitMessage
    const message = new Message(voteData)
    const payload = message.encoded
    try {
      globalThis.peernet.publish(`consensus:${type}`, payload)
    } catch (e) {
      debug(`peernet publish failed: consensus:${type}`, (e as Error)?.message ?? e)
    }
  }

  /**
   * Phase 2 — receive a block proposal from the designated proposer.
   * Validates the proposer is correct for height/round, fetches + validates
   * the block from peernet, then casts a prevote.
   */
  #handleProposal = async (payload) => {
    try {
      const message = new ProposalMessage(payload)
      const msg = message.decoded
      const { blockHash, index, round, from } = msg

      const validators = await this.#getConsensusValidators(Number(index))
      const expectedProposerIdx = Number((index + round) % BigInt(validators.length))
      if (!validators[expectedProposerIdx] || validators[expectedProposerIdx] !== from) {
        debug(`[consensus] Proposal from wrong proposer at height ${index} round ${round}`)
        return
      }

      const localBlock = await this.lastBlock
      const localIndex = localBlock?.index !== undefined ? localBlock.index : -1n
      if (index <= localIndex) {
        debug(`[consensus] Ignoring stale proposal at height ${index} (local: ${localIndex})`)
        return
      }

      // Fetch block from peernet and verify its hash
      try {
        const blockData = await globalThis.peernet.get(blockHash, 'block')
        const blockMessage = await new BlockMessage(blockData)
        const actualHash = await blockMessage.hash()
        if (actualHash !== blockHash) {
          debug(`[consensus] Block hash mismatch in proposal: expected ${blockHash}, got ${actualHash}`)
          return
        }
      } catch (e) {
        debug(`[consensus] Cannot fetch proposed block ${blockHash}:`, (e as Error)?.message)
        return
      }

      this.#consensusRound = Number(round)
      if (this.#roundTimer) {
        clearTimeout(this.#roundTimer)
        this.#roundTimer = null
      }

      if (validators.includes(peernet.selectedAccount) && !this.#isJailed(peernet.selectedAccount)) {
        await this.#castVote('prevote', blockHash, Number(index), Number(round))
      }
    } catch (e) {
      debug('[consensus] Error handling proposal:', (e as Error)?.message)
    }
  }

  /**
   * Phase 2 — collect prevotes. Once 2f+1 prevotes are seen for a block,
   * cast a precommit.
   */
  #handlePrevote = async (payload) => {
    try {
      const message = new PrevoteMessage(payload)
      const msg = message.decoded
      const { blockHash, index, round, from } = msg

      const validators = await this.#getConsensusValidators(Number(index))
      if (!validators.includes(from)) return

      const localBlock = await this.lastBlock
      const localIndex = localBlock?.index !== undefined ? localBlock.index : -1n
      if (index <= localIndex) return

      const voteKey = `${index}:${round}:${blockHash}`
      if (!this.#prevotes.has(voteKey)) this.#prevotes.set(voteKey, new Set())
      this.#prevotes.get(voteKey)!.add(from)

      const threshold = Math.ceil((2 * validators.length) / 3)
      const voteCount = this.#prevotes.get(voteKey)!.size
      debug(`[consensus] Prevotes ${voteKey}: ${voteCount}/${validators.length} (need ${threshold})`)

      if (
        voteCount >= threshold &&
        validators.includes(peernet.selectedAccount) &&
        !this.#isJailed(peernet.selectedAccount)
      ) {
        await this.#castVote('precommit', blockHash, Number(index), Number(round))
      }
    } catch (e) {
      debug('[consensus] Error handling prevote:', (e as Error)?.message)
    }
  }

  /**
   * Phase 3 — collect precommits. Once 2f+1 precommits are seen for a block,
   * commit it: non-proposers call #addBlock, then broadcast on add-block for
   * syncing nodes.
   */
  #handlePrecommit = async (payload) => {
    try {
      const message = new PrecommitMessage(payload)
      const msg = message.decoded
      const { blockHash, index, round, from } = msg

      const validators = await this.#getConsensusValidators(Number(index))
      if (!validators.includes(from)) return
      if (index <= BigInt(this.#committedHeight)) return

      const voteKey = `${index}:${round}:${blockHash}`
      if (!this.#precommits.has(voteKey)) this.#precommits.set(voteKey, new Set())
      this.#precommits.get(voteKey)!.add(from)

      const threshold = Math.ceil((2 * validators.length) / 3)
      const voteCount = this.#precommits.get(voteKey)!.size
      debug(`[consensus] Precommits ${voteKey}: ${voteCount}/${validators.length} (need ${threshold})`)

      if (voteCount >= threshold && index > BigInt(this.#committedHeight)) {
        this.#committedHeight = Number(index)
        this.#consensusRound = 0

        // Prune vote state for committed and older heights
        for (const key of [...this.#prevotes.keys()]) {
          if (BigInt(key.split(':')[0]) <= index) this.#prevotes.delete(key)
        }
        for (const key of [...this.#precommits.keys()]) {
          if (BigInt(key.split(':')[0]) <= index) this.#precommits.delete(key)
        }
        for (const key of [...this.#castedVotes]) {
          if (BigInt(key.split(':')[1]) <= index) this.#castedVotes.delete(key)
        }

        // Non-proposers add the block to local state now.
        // Proposers already committed state in #createBlock() and their
        // lastBlock.index === index, so the guard below skips them.
        const currentBlock = await this.lastBlock
        const currentIndex = currentBlock?.index !== undefined ? currentBlock.index : -1n
        if (index > currentIndex) {
          debug(`[consensus] ✅ Committing block ${blockHash} at height ${index}`)
          try {
            const blockData = await globalThis.peernet.get(blockHash, 'block')
            await this.#addBlock(blockData)
          } catch (e) {
            debug(`[consensus] Failed to commit block ${blockHash}:`, (e as Error)?.message)
          }
        } else {
          debug(`[consensus] ✅ Block ${blockHash} at height ${index} already committed (proposer path)`)
        }

        // Broadcast committed block so syncing / non-participating nodes can catch up
        try {
          const blockData = await globalThis.peernet.get(blockHash, 'block')
          globalThis.peernet.publish('add-block', blockData)
          globalThis.pubsub.publish('add-block', blockData)
        } catch (e) {
          debug('[consensus] Failed to broadcast committed block:', (e as Error)?.message)
        }
      }
    } catch (e) {
      debug('[consensus] Error handling precommit:', (e as Error)?.message)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  #addTransaction = async (message) => {
    const transaction = new TransactionMessage(message)
    const hash = await transaction.hash()
    // if (await transactionPoolStore.has(hash)) await transactionPoolStore.delete(hash)
    debug(`added ${hash}`)
  }

  async #prepareRequest(request) {
    let node = await new globalThis.peernet.protos['peernet-request']({ request })
    return globalThis.peernet.prepareMessage(node)
  }

  async #makeRequest(peer, request) {
    const node = await this.#prepareRequest(request)
    try {
      let response = await peer.request(node.encoded)
      response = await new globalThis.peernet.protos['peernet-response'](response)

      if (!(response.decoded.response instanceof Uint8Array)) {
        console.warn(`Deprecated: ${response.decoded.response} is not an Uint8Array`)
      }
      return response.decoded.response
    } catch (error) {
      const peerId = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || 'unknown'
      debug(`peernet request failed: ${request} -> ${peerId}:`, (error as Error)?.message ?? error)
      throw error
    }
  }

  async #decodeKnownBlocksResponse(response: any): Promise<{ blocks: string[] } | null> {
    if (!response) return null

    if (Array.isArray(response.blocks)) {
      return { blocks: response.blocks }
    }

    if (response instanceof Uint8Array) {
      // Compatibility path for peers that still return bytes instead of decoded object payloads.
      try {
        const decodedText = new TextDecoder().decode(response)
        const parsed = JSON.parse(decodedText)
        if (Array.isArray(parsed)) return { blocks: parsed }
        if (parsed && Array.isArray(parsed.blocks)) return { blocks: parsed.blocks }
      } catch {
        // Fall through to nested peernet-response decode below.
      }

      try {
        const nestedResponse = await new globalThis.peernet.protos['peernet-response'](response)
        const nestedPayload = nestedResponse?.decoded?.response
        if (Array.isArray(nestedPayload)) return { blocks: nestedPayload }
        if (nestedPayload && Array.isArray(nestedPayload.blocks)) {
          return { blocks: nestedPayload.blocks }
        }
        if (nestedPayload instanceof Uint8Array) {
          try {
            const nestedText = new TextDecoder().decode(nestedPayload)
            const nestedParsed = JSON.parse(nestedText)
            if (Array.isArray(nestedParsed)) return { blocks: nestedParsed }
            if (nestedParsed && Array.isArray(nestedParsed.blocks)) return { blocks: nestedParsed.blocks }
          } catch {
            return null
          }
        }
      } catch {
        return null
      }
    }

    return null
  }

  async getPeerTransactionPool(peer) {
    let transactionsInPool = await this.#makeRequest(peer, 'transactionPool')
    if (transactionsInPool instanceof Uint8Array) {
      debug('transactionPool response must be decoded array payload')
      return []
    }
    if (!Array.isArray(transactionsInPool)) return []

    // todo iterate vs getting all keys?
    const transactions = await globalThis.transactionPoolStore.keys()

    const transactionsToGet = []

    for (const key of transactionsInPool) {
      let txData
      try {
        txData = await globalThis.peernet.get(key, 'transaction')
      } catch (error) {
        debug(`Failed to get transaction ${key}:`, (error as Error)?.message ?? error)
      }
      if (txData !== undefined && !transactions.includes(key)) {
        transactionsToGet.push(transactionPoolStore.put(key, txData))
      }
    }
    return Promise.all(transactionsToGet)
  }

  async #peerConnected(peerId) {
    debug(`peer connected: ${peerId}`)
    const peer = peernet.getConnection(peerId)

    if (!peer) {
      debug(`peer not found: ${peerId}`)
      return
    }

    if (!peer.version) {
      try {
        let versionResponse: any = await this.#makeRequest(peer, 'version')

        if (versionResponse instanceof Uint8Array) {
          versionResponse = new TextDecoder().decode(versionResponse)
        }

        if (typeof versionResponse === 'string') {
          peer.version = versionResponse
        } else if (
          versionResponse &&
          typeof versionResponse === 'object' &&
          typeof versionResponse.version === 'string'
        ) {
          peer.version = versionResponse.version
        }

        if (!peer.version || typeof peer.version !== 'string') {
          const reason = `invalid version response from peer ${peerId}`
          debug(reason)
          await this.#recordPeerFailure(peerId, reason)
          return
        }
      } catch (error) {
        debug(`failed to request version from peer ${peerId}:`, (error as Error)?.message ?? error)
        return
      }
    }

    debug(`peer connected with version ${peer.version}`)
    if (!this.isVersionCompatible(peer.version)) {
      const mismatchReason = `incompatible peer version ${peer.version} (local: ${this.version})`
      console.error(`[chain] ${mismatchReason}`)
      await this.#recordPeerFailure(peerId, mismatchReason)
      return
    }

    let lastBlock
    try {
      console.log('requesting last block from peer...')
      console.log(await this.lastBlock)
      console.log(new LastBlockMessage(await this.#makeRequest(peer, 'lastBlock')))
      lastBlock = new LastBlockMessage(await this.#makeRequest(peer, 'lastBlock')).decoded
    } catch (error) {
      const peerName = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || peerId || 'unknown'
      debug(`lastBlock request failed: ${peerName}:`, (error as Error)?.message ?? error)
      await this.#recordPeerFailure(peerId, `lastBlock request failed: ${(error as Error)?.message ?? error}`)
      return
    }

    // CRITICAL: Validate the peer's claimed block height is not unreasonably ahead of our local chain
    // This prevents Byzantine nodes from claiming a fake chain length to steer our sync
    const localBlock = await this.lastBlock
    const MAX_SYNC_AHEAD = 100_000
    if (lastBlock?.index > BigInt(localBlock?.index ?? 0) + BigInt(MAX_SYNC_AHEAD)) {
      const peerName = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || peerId || 'unknown'
      debug(`Peer ${peerName} claims unreasonable block height ${lastBlock.index} (local: ${localBlock?.index ?? 0})`)
      await this.#recordPeerFailure(peerId, `unreasonable lastBlock index: ${lastBlock.index}`)
      return
    }

    if (!lastBlock || !lastBlock.hash || lastBlock.hash === '0x0') {
      debug(`peer has no lastBlock: ${peerId}`)
      return
    }

    const higherThenCurrentLocal = !localBlock?.index ? true : lastBlock.index > localBlock.index

    if (lastBlock) {
      if (!this.lastBlock || higherThenCurrentLocal) {
        try {
          const knownBlocksRaw = await this.#makeRequest(peer, 'knownBlocks')
          const knownBlocksResponse = await this.#decodeKnownBlocksResponse(knownBlocksRaw)
          if (!knownBlocksResponse) {
            const reason = `knownBlocks decode failed for peer ${peerId}`
            debug(reason)
            await this.#recordPeerFailure(peerId, reason)
            return
          }
          const MAX_WANTLIST_SIZE = 1000
          const remaining = MAX_WANTLIST_SIZE - this.wantList.length
          if (remaining > 0) {
            for (const hash of knownBlocksResponse.blocks.slice(0, remaining)) {
              this.wantList.push(hash)
            }
          }
        } catch (error) {
          const peerName = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || peerId || 'unknown'
          debug(`knownBlocks request failed: ${peerName}:`, (error as Error)?.message ?? error)
          await this.#recordPeerFailure(peerId, `knownBlocks request failed: ${(error as Error)?.message ?? error}`)
          return
        }
      }
    }

    if (this.wantList.length > 0) {
      const promises = await Promise.allSettled(this.wantList.map((hash) => peernet.get(hash, 'block')))
      for (let i = 0; i < promises.length; i++) {
        const result = promises[i]
        if (result.status === 'fulfilled') this.wantList.splice(i, 1)
      }
      // todo trigger load instead?
      if (this.wantList.length === 0) await this.triggerSync()
    }
    setTimeout(async () => {
      try {
        const peerTransactionPool = (higherThenCurrentLocal && (await this.getPeerTransactionPool(peer))) || []
        if (this.#participating && peerTransactionPool.length > 0) return this.#runEpoch()
      } catch (error) {
        const peerName = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || peerId || 'unknown'
        debug(`transactionPool request failed: ${peerName}:`, (error as Error)?.message ?? error)
      }
    }, 3000)

    try {
      let stateInfo = await this.#makeRequest(peer, 'stateInfo')
      if (stateInfo instanceof Uint8Array) {
        stateInfo = new StateMessage(stateInfo).decoded
      }
      await this.syncChain(lastBlock)
      this.machine.states.info = stateInfo
    } catch (error) {
      const peerName = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || peerId || 'unknown'
      debug(`stateInfo/syncChain failed: ${peerName}:`, (error as Error)?.message ?? error)
      await this.#recordPeerFailure(peerId, `stateInfo/syncChain failed: ${(error as Error)?.message ?? error}`)
      return
    }
  }

  #epochTimeout

  async #transactionPoolHandler() {
    const pool = await globalThis.transactionPoolStore.keys()
    return new globalThis.peernet.protos['peernet-response']({ response: pool })
  }

  async #versionHandler() {
    return new globalThis.peernet.protos['peernet-response']({ response: this.version })
  }

  async #executeTransaction({ hash, from, to, method, params, nonce }) {
    try {
      let result = await this.machine.execute(to, method, params)
      // await accountsStore.put(to, nonce)
      // if (!result) result = this.machine.state
      globalThis.pubsub.publish(`transaction.completed.${hash}`, { status: 'fulfilled', hash })
      return result || 'no state change'
    } catch (error) {
      await transactionPoolStore.delete(hash)
      try {
        globalThis.peernet.publish('invalid-transaction', hash)
      } catch (publishError) {
        debug('peernet publish failed: invalid-transaction', (publishError as Error)?.message ?? publishError)
      }
      globalThis.pubsub.publish(`transaction.completed.${hash}`, { status: 'fail', hash, error: error })
      throw { error, hash, from, to, params, nonce }
    }
  }

  async #addBlock(block) {
    // Store the original received encoded bytes for validation
    const receivedEncoded = block instanceof BlockMessage ? block.encoded : block

    const blockMessage = await new BlockMessage(block)

    const hash = await blockMessage.hash()

    // CRITICAL: VALIDATE BEFORE TOUCHING STATE
    // 1. Check for duplicate blocks at same height
    const blockIndex = Number(blockMessage.decoded.index)
    const existingBlockAtHeight = this.#blocks[blockIndex]
    if (existingBlockAtHeight) {
      if (existingBlockAtHeight.hash !== hash) {
        console.error(`[CONSENSUS ALERT] Conflicting blocks at height ${blockIndex}:`)
        console.error(`  Local:  ${existingBlockAtHeight.hash}`)
        console.error(`  Remote: ${hash}`)
        throw new Error(`Block conflict detected at index ${blockIndex}`)
      }
      // Already have this exact block, skip
      debug(`Block already in store: ${hash}`)
      return
    }

    // 2. Verify previous hash chain integrity
    if (blockIndex > 0) {
      const previousBlockInfo = this.#blocks[blockIndex - 1]
      if (!previousBlockInfo) {
        throw new Error(`Missing parent block at index ${blockIndex - 1}`)
      }
      if (previousBlockInfo.hash !== blockMessage.decoded.previousHash) {
        throw new Error(
          `previousHash mismatch at index ${blockIndex}: ` +
            `expected ${previousBlockInfo.hash}, got ${blockMessage.decoded.previousHash}`
        )
      }
    } else if (blockMessage.decoded.previousHash !== '0x0') {
      throw new Error(`Genesis block (index 0) must have previousHash='0x0'`)
    }

    // 3. Verify data integrity
    const canonicalEncoded = blockMessage.encoded
    const byteLengthMatch = receivedEncoded.length === canonicalEncoded.length

    if (!byteLengthMatch) {
      throw new Error(
        `[FATAL] Block data size mismatch: received ${receivedEncoded.length} bytes ` +
          `but canonical encoding is ${canonicalEncoded.length} bytes for block #${blockMessage.decoded.index}`
      )
    }

    let mismatch = false
    for (let i = 0; i < receivedEncoded.length; i++) {
      if (receivedEncoded[i] !== canonicalEncoded[i]) {
        mismatch = true
        break
      }
    }

    if (mismatch) {
      throw new Error(`[FATAL] Block data corrupted in transit for block #${blockIndex} hash ${hash}`)
    }

    console.log(`[chain] ✅ Block data integrity verified: ${hash}`)
    this.#validateBlockValidators(blockMessage)

    // NOW SAFE TO PROCEED with transaction processing
    const transactions = await Promise.all(
      blockMessage.decoded.transactions
        // @ts-ignore
        .map(async (hash) => {
          const data = await peernet.get(hash, 'transaction')
          // transactionStore.put(hash, data)
          ;(await transactionPoolStore.has(hash)) && (await transactionPoolStore.delete(hash))
          return new TransactionMessage(data)
        })
    )

    await globalThis.blockStore.put(hash, blockMessage.encoded)

    // Cache block for conflict detection
    this.#blocks[blockIndex] = {
      hash,
      ...blockMessage.decoded
    }

    debug(`added block: ${hash}`)
    let promises = []
    let contracts: any[] = []

    // Combine and sort all transactions deterministically
    const allTransactions = transactions.sort((a, b) => {
      // Primary: by priority (true first)
      if (a.decoded.priority !== b.decoded.priority) {
        return (b.decoded.priority ? 1 : 0) - (a.decoded.priority ? 1 : 0)
      }
      // Secondary: by nonce
      const nonceDiff = (a.decoded?.nonce ?? 0) - (b.decoded?.nonce ?? 0)
      if (nonceDiff !== 0) return nonceDiff
      // Tertiary: in stable order (insertion order preserved)
      return 0
    })

    // Execute sequentially (NOT concurrently) to ensure deterministic state
    for (const transaction of allTransactions) {
      if (!contracts.includes(transaction.decoded.to)) {
        contracts.push(transaction.decoded.to)
      }
      await this.#handleTransaction(transaction, [])
    }

    // for (let transaction of transactionsMessages) {
    //   // await transactionStore.put(transaction.hash, transaction.encoded)
    //   if (!contracts.includes(transaction.to)) {
    //     contracts.push(transaction.to)
    //   }
    //   // Todo: go trough all accounts
    //   //@ts-ignore
    //   promises.push(this.#executeTransaction(transaction))
    // }
    try {
      promises = await Promise.allSettled(promises)
      const noncesByAddress = {}
      for (let transaction of transactions) {
        globalThis.pubsub.publish('transaction-processed', transaction.encoded)
        if (transaction.decoded.to === globalThis.peernet.selectedAccount)
          globalThis.pubsub.publish('account-transaction-processed', transaction.encoded)
        if (
          !noncesByAddress[transaction.decoded.from] ||
          noncesByAddress?.[transaction.decoded.from] < transaction.decoded.nonce
        ) {
          noncesByAddress[transaction.decoded.from] = transaction.decoded.nonce
        }
      }
      await Promise.all(
        Object.entries(noncesByAddress).map(([from, nonce]) => globalThis.accountsStore.put(from, String(nonce)))
      )

      if ((await this.lastBlock).index < Number(blockMessage.decoded.index)) {
        await this.machine.addLoadedBlock({ ...blockMessage.decoded, loaded: true, hash: await blockMessage.hash() })

        // Record validator snapshot at this block height for future consensus queries
        try {
          await this.call(addresses.validators, 'recordValidatorSnapshot', [blockMessage.decoded.index])
        } catch (snapshotError) {
          debug(`failed to record validator snapshot: ${(snapshotError as Error)?.message ?? snapshotError}`)
        }

        // Check if this block crosses epoch boundary and handle transition
        await this.#handleEpochBoundary(Number(blockMessage.decoded.index))

        await this.updateState(blockMessage)
      }
      globalThis.pubsub.publish('block-processed', blockMessage.decoded)
    } catch (error) {
      console.log(error.hash)
      console.log('errrrr')

      await transactionPoolStore.delete(error.hash)
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
    try {
      if (!(await this.staticCall(addresses.validators, 'has', [address]))) {
        const rawTransaction = {
          from: address,
          to: addresses.validators,
          method: 'addValidator',
          params: [address],
          nonce: (await this.getNonce(address)) + 1,
          timestamp: Date.now()
        }

        const transaction = await signTransaction(rawTransaction, globalThis.peernet.identity)
        try {
          await this.sendTransaction(transaction)
        } catch (error) {
          console.error(error)
        }
      }
    } catch (error) {
      debug('Error in participate:', error.message)
      // Continue anyway - validator check is optional
    }
    if ((await this.hasTransactionToHandle()) && !this.#runningEpoch && this.#participating) await this.#runEpoch()
  }

  async #handleTransaction(transaction, latestTransactions, block?) {
    const hash = await transaction.hash()

    const doubleTransactions = []

    if (latestTransactions.includes(hash) || (await transactionStore.has(hash))) {
      doubleTransactions.push(hash)
    }

    if (doubleTransactions.length > 0) {
      await globalThis.transactionPoolStore.delete(hash)
      await globalThis.peernet.publish('invalid-transaction', hash)
      return
    }

    // if (timestamp + this.#slotTime > Date.now()) {
    try {
      const result = await this.#executeTransaction({ ...transaction.decoded, hash })
      if (block) {
        block.transactions.push(hash)

        block.fees = block.fees += await calculateFee(transaction.decoded)
      }

      await globalThis.accountsStore.put(
        transaction.decoded.from,
        new TextEncoder().encode(String(transaction.decoded.nonce))
      )
      // Don't cache nonce during parallel processing - always query pool
      await transactionStore.put(hash, await transaction.encode())
    } catch (e) {
      console.log('vvvvvv')

      console.log({ e })
      console.log(hash)
      peernet.publish('invalid-transaction', hash)

      await globalThis.transactionPoolStore.delete(e.hash)
    }
  }

  // todo filter tx that need to wait on prev nonce
  async #createBlock(limit = this.transactionLimit) {
    console.log(await globalThis.transactionPoolStore.size())

    // vote for transactions
    if ((await globalThis.transactionPoolStore.size()) === 0) return

    let transactions = await globalThis.transactionPoolStore.values(this.transactionLimit)

    if (Object.keys(transactions)?.length === 0) return

    const timestamp = Date.now()

    let block = {
      transactions: [],
      validators: [],
      fees: BigInt(0),
      timestamp,
      previousHash: '',
      reward: BigInt(150),
      index: 0,
      producer: '',
      producerProof: '',
      protocolVersion: this.version
    }

    const latestTransactions = await this.machine.latestTransactions()

    // exclude failing tx
    transactions = await this.promiseTransactions(transactions)

    // Combine priority and normal transactions, then sort deterministically
    const allTransactions = transactions.sort((a, b) => {
      // Primary: by priority (true first)
      if (a.decoded.priority !== b.decoded.priority) {
        return (b.decoded.priority ? 1 : 0) - (a.decoded.priority ? 1 : 0)
      }
      // Secondary: by nonce
      const nonceDiff = (a.decoded?.nonce ?? 0) - (b.decoded?.nonce ?? 0)
      if (nonceDiff !== 0) return nonceDiff
      // Tertiary: in stable order (insertion order preserved)
      return 0
    })

    // Execute sequentially (NOT concurrently) to ensure deterministic state
    for (const transaction of allTransactions) {
      await this.#handleTransaction(transaction, latestTransactions, block)
    }

    // don't add empty block
    if (block.transactions.length === 0) return

    const validators = (await this.staticCall(addresses.validators, 'validators')) as Validators['validators']
    // block.validators = Object.keys(block.validators).reduce((set, key) => {
    //   if (block.validators[key].active) {
    //     push({
    //       address: key
    //     })
    //   }
    // }, [])
    const peers = {}
    for (const entry of globalThis.peernet.peers) {
      peers[entry[0]] = entry[1]
    }

    for (const validator of validators) {
      const peer = peers[validator]
      if (peer && peer.connected && this.isVersionCompatible(peer.version)) {
        let data = await new BWRequestMessage()
        const node = await globalThis.peernet.prepareMessage(data.encoded)
        try {
          const bw = await peer.request(node.encoded)
          block.validators.push({
            address: validator,
            bw: bw.up + bw.down
          })
        } catch (error) {
          const peerId = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || 'unknown'
          debug(`bw request failed: ${peerId}:`, (error as Error)?.message ?? error)
        }
      } else if (globalThis.peernet.selectedAccount === validator) {
        block.validators.push({
          address: globalThis.peernet.selectedAccount,
          bw: globalThis.peernet.bw.up + globalThis.peernet.bw.down
        })
      }
    }

    block.validators = block.validators.map((validator) => {
      validator.reward = block.fees
      validator.reward += block.reward
      validator.reward /= BigInt(block.validators.length)
      delete validator.bw
      return validator
    })
    // block.validators = calculateValidatorReward(block.validators, block.fees)

    const localBlock = await this.lastBlock
    block.index = localBlock.index
    if (block.index === undefined) block.index = 0
    else block.index += 1

    block.previousHash = localBlock.hash || '0x0'
    // block.timestamp = Date.now()
    // block.reward = block.reward.toString()
    // block.fees = block.fees.toString()

    // CRITICAL FIX: Sort validators deterministically to avoid encoding divergence
    // Use canonical validator set from contract, sorted by address
    const canonicalValidators = (await this.staticCall(addresses.validators, 'validators')) as Validators['validators']
    const sortedValidators = [...canonicalValidators].sort()

    // Apply reward to all canonical validators (deterministic)
    block.validators = sortedValidators.map((validatorAddress) => ({
      address: validatorAddress,
      reward: block.fees / BigInt(sortedValidators.length) + block.reward / BigInt(sortedValidators.length)
    }))

    try {
      await Promise.all(
        block.transactions.map(async (transaction: string) => {
          await globalThis.transactionStore.put(transaction, await transactionPoolStore.get(transaction))
          await globalThis.transactionPoolStore.delete(transaction)
        })
      )

      // Set producer to current account
      block.producer = globalThis.peernet.selectedAccount || ''

      // Sign block hash to authenticate producer (producer must be the proposer)
      if (block.producer && this.keypair) {
        const blockHashInput = JSON.stringify({
          index: block.index,
          previousHash: block.previousHash,
          timestamp: block.timestamp,
          validators: block.validators.map((v) => v.address).sort()
        })
        block.producerProof = await signTransaction(blockHashInput, this.keypair)
      }

      let blockMessage = await new BlockMessage(block)

      const hash = await blockMessage.hash()

      await globalThis.peernet.put(hash, blockMessage.encoded, 'block')
      await this.machine.addLoadedBlock({ ...blockMessage.decoded, loaded: true, hash: await blockMessage.hash() })
      await this.updateState(blockMessage)
      debug(`created block: ${hash} @${block.index}`)

      // Phase 2: announce proposal for consensus voting instead of direct add-block
      console.log(`[consensus] 📤 Proposing block #${block.index} | hash: ${hash} | round: ${this.#consensusRound}`)
      const proposalData = {
        blockHash: hash,
        index: BigInt(block.index),
        round: BigInt(this.#consensusRound),
        from: peernet.selectedAccount
      }
      const proposalMessage = new ProposalMessage(proposalData)
      const proposalPayload = proposalMessage.encoded
      try {
        globalThis.peernet.publish('consensus:propose', proposalPayload)
      } catch (publishError) {
        debug('peernet publish failed: consensus:propose', (publishError as Error)?.message ?? publishError)
      }
      // Proposer casts their own prevote immediately
      await this.#castVote('prevote', hash, block.index, this.#consensusRound)
    } catch (error) {
      console.log(error)

      throw new Error(`invalid block ${block}`)
    }
    // data = await this.machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  async #sendTransaction(transaction) {
    transaction = await new TransactionMessage(transaction.encoded || transaction)
    const hash = await transaction.hash()

    try {
      const has = await globalThis.transactionPoolStore.has(hash)

      if (!has && !(await transactionStore.has(hash))) {
        await globalThis.transactionPoolStore.put(hash, transaction.encoded)
      }
      if (this.#participating && !this.#runningEpoch) this.#runEpoch()
    } catch (e) {
      try {
        globalThis.peernet.publish('invalid-transaction', hash)
      } catch (publishError) {
        debug('peernet publish failed: invalid-transaction', (publishError as Error)?.message ?? publishError)
      }
      throw new Error('invalid transaction')
    }
  }
  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   **/
  async sendTransaction(transaction) {
    const transactionMessage = await new TransactionMessage({ ...transaction })
    const event = await super.sendTransaction(transactionMessage)

    this.#sendTransaction(transactionMessage.encoded)
    try {
      globalThis.peernet.publish('send-transaction', transactionMessage.encoded)
    } catch (publishError) {
      debug('peernet publish failed: send-transaction', (publishError as Error)?.message ?? publishError)
    }
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
  #createMessage(sender = globalThis.peernet.selectedAccount, contract) {
    return {
      contract,
      sender,
      call: this.call,
      staticCall: this.staticCall
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
  internalCall(sender: Address, contract: Address, method: string, parameters?: any[]) {
    // globalThis.msg = this.#createMessage(sender, contract) // Debug line removed

    return this.machine.execute(contract, method, parameters)
  }

  /**
   *
   * @param {Address} contract
   * @param {String} method
   * @param {Array} parameters
   * @returns
   */
  call(contract: Address, method: string, parameters?: any[]) {
    // globalThis.msg = this.#createMessage(peernet.selectedAccount, contract) // Debug line removed

    return this.machine.execute(contract, method, parameters)
  }

  staticCall(contract: Address, method: string, parameters?: any[]) {
    // globalThis.msg = this.#createMessage(peernet.selectedAccount, contract) // Debug line removed
    return this.machine.get(contract, method, parameters)
  }

  mint(to: Address, amount: bigint) {
    return this.call(addresses.nativeToken, 'mint', [to, amount])
  }

  transfer(from: Address, to: Address, amount: bigint) {
    return this.call(addresses.nativeToken, 'transfer', [from, to, amount])
  }

  balanceOf(address: Address): Promise<bigint> {
    return this.staticCall(addresses.nativeToken, 'balanceOf', [address])
  }

  get balance(): Promise<bigint> {
    return this.staticCall(addresses.nativeToken, 'balanceOf', [globalThis.peernet.selectedAccount])
  }

  get balances(): Promise<{ [index: string]: bigint }> {
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
  lookup(name): Promise<{ owner; address }> {
    return this.call(addresses.nameService, 'lookup', [name])
  }

  #monitorPeerConnections() {
    setInterval(() => {
      const connectedPeers = Object.values(globalThis.peernet.connections).filter((peer) => peer.connected)
      debug(`Connected peers: ${connectedPeers.length}`)

      if (connectedPeers.length === 0) {
        debug('No peers connected, attempting to reconnect...')
        this.#attemptPeerReconnection()
      }
    }, 10000) // Check every 10 seconds
  }

  async #attemptPeerReconnection() {
    try {
      // Try to reconnect to star servers
      if (globalThis.peernet && globalThis.peernet.start) {
        await globalThis.peernet.start()
      }
    } catch (error) {
      console.warn('Failed to reconnect to peers:', error.message)
    }
  }
}

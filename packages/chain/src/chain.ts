import { createDebugger } from '@vandeurenglenn/debug'
import { Codec } from '@leofcoin/codec-format-interface'
import { formatUnits, parseUnits, formatBytes } from '@leofcoin/utils'
import {
  ContractMessage,
  TransactionMessage,
  BlockMessage,
  BWMessage,
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
  calculateFee,
  createTransactionHash
} from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'
import VersionControl from './version-control.js'
import ConnectionMonitor from './connection-monitor.js'
import { quorumThreshold } from './consensus/quorum.js'
import { validateChainLink } from './consensus/chain-link.js'
import { resolveTransactionReference } from './consensus/transaction-reference.js'
import { signConsensusMessage, verifyConsensusMessage } from './consensus/signature.js'
import { nextBlockIndex, proposalDelay } from './consensus/cadence.js'
import { compareTransactionNonces, pruneCanonicalTransactions } from './consensus/transaction-pool.js'
import { resolveLastBlockMessage } from './helpers/last-block.js'

const debug = createDebugger('leofcoin/chain')

// check if browser or local
export default class Chain extends VersionControl {
  #state

  #slotTime = 10000
  #blockTime = 6000 // 6 second target block time
  /** Wall-clock time of the last local proposal attempt. */
  #lastProposalAt = 0
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
  /** Locally proposed block awaiting quorum; prevents duplicate proposals at one height. */
  #proposalInFlight: { hash: string; index: number; round: number } | null = null
  /** Timer that advances #consensusRound when the proposer doesn't propose in time */
  #roundTimer: ReturnType<typeof setTimeout> | null = null
  /** prevotes collected per `height:round:blockHash` key */
  #prevotes: Map<string, Set<string>> = new Map()
  /** precommits collected per `height:round:blockHash` key */
  #precommits: Map<string, Set<string>> = new Map()
  /** Index of the last block that reached 2f+1 precommits */
  #committedHeight: number = -1
  /** Heights currently applying to local state; prevents duplicate concurrent commits. */
  #committingHeights: Set<number> = new Set()
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

  async #signConsensusMessage(type: 'proposal' | 'prevote' | 'precommit', message): Promise<string> {
    const identity = globalThis.peernet?.identity
    return signConsensusMessage(addresses.validators, type, message, identity)
  }

  async #verifyConsensusMessage(
    type: 'proposal' | 'prevote' | 'precommit',
    message: { blockHash: unknown; index: unknown; round: unknown; from: unknown; signature?: unknown }
  ): Promise<boolean> {
    return verifyConsensusMessage(
      addresses.validators,
      type,
      message,
      globalThis.peernet?.network || 'leofcoin'
    )
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

  async #validateBlockValidators(blockMessage: BlockMessage): Promise<void> {
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

    const unsignedBlockMessage = new BlockMessage({ ...blockMessage.decoded, producerProof: '' })
    const unsignedBlockHash = await unsignedBlockMessage.hash()
    const proofPayload = await createTransactionHash({
      from: blockMessage.decoded.producer,
      to: addresses.validators,
      method: 'produceBlock',
      params: [unsignedBlockHash],
      timestamp: Number(blockMessage.decoded.timestamp)
    })
    const network = globalThis.peernet?.network || 'leofcoin'
    const verifier = new MultiWallet(network)
    await verifier.fromAddress(blockMessage.decoded.producer, null, network)
    const validProducerProof = await verifier.verify(fromBase58(blockMessage.decoded.producerProof), proofPayload)
    if (!validProducerProof) {
      throw new Error(`Block ${blockMessage.decoded.index} has an invalid producerProof`)
    }

    const validatorAddresses = validators.map((validator) => validator.address)
    if (validatorAddresses.some((address) => typeof address !== 'string' || address.length === 0)) {
      throw new Error(`Block ${blockMessage.decoded.index} includes an invalid validator address`)
    }

    const canonicalAddresses = [...validatorAddresses].sort()
    if (canonicalAddresses.some((address, index) => address !== validatorAddresses[index])) {
      throw new Error(`Block ${blockMessage.decoded.index} validators are not canonically sorted`)
    }

    if (new Set(validatorAddresses).size !== validatorAddresses.length) {
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

  async #resolveBlockTransactions(blockMessage: BlockMessage): Promise<TransactionMessage[]> {
    return Promise.all(
      blockMessage.decoded.transactions.map(async (expectedHash) => {
        const data = await globalThis.peernet.get(expectedHash, 'transaction')
        const transaction = await resolveTransactionReference(expectedHash, data)
        await this.validateTransactionSignature(transaction)
        return transaction
      })
    )
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
    const validators = await this.#getConsensusValidators()

    if (this.#isJailed(peernet.selectedAccount)) {
      this.#runningEpoch = false
      return
    }

    if (!validators.includes(peernet.selectedAccount)) {
      this.#runningEpoch = false
      return
    }

    // Apply cadence before every attempt. The canonical timestamp prevents a
    // newly triggered epoch from proposing too soon after the previous block;
    // the local timestamp also throttles empty/failed proposal attempts.
    let localBlock = await this.lastBlock
    const delay = proposalDelay({
      now: Date.now(),
      lastBlockTimestamp: Number(localBlock?.timestamp ?? 0),
      lastProposalAt: this.#lastProposalAt,
      blockTime: this.#blockTime
    })
    if (delay > 0) await this.#sleep(delay)

    // Re-read the canonical tip after waiting: a peer may have committed the
    // next height and changed the deterministic proposer in the meantime.
    localBlock = await this.lastBlock

    // Phase 1: Deterministic proposer selection
    // proposer = validators[(nextBlockIndex + round) % validators.length]
    const nextIndex = nextBlockIndex(localBlock?.index)
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

    this.#lastProposalAt = Date.now()

    try {
      await this.#createBlock()
    } catch (error) {
      console.error(error)
    }

    const hasMore = await this.hasTransactionToHandle()

    this.#runningEpoch = false
    if (hasMore && !this.#proposalInFlight) return this.#runEpoch()
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
    console.log('[chain] init:start')

    const initialized = await globalThis.contractStore.has(addresses.contractFactory)
    console.log(`chain initialized: ${initialized}`)
    if (!initialized) await this.#setup()

    this.utils = { formatUnits, parseUnits }

    // this.#state = new State()
    console.log('init')

    // todo some functions rely on state
    await super.init()
    console.log('super init done')
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
    await globalThis.peernet.addRequestHandler('stateInfo', async () => {
      const lastblock = (await this.lastBlock) || { index: 0, hash: '0x0', previousHash: '0x0' }
      const values = this.machine?.states?.info || {}
      return new globalThis.peernet.protos['peernet-response']({
        response: new StateMessage({ lastblock, values }).encoded
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

    const from = peernet.selectedAccount
    const unsignedVote = { blockHash, index: BigInt(index), round: BigInt(round), from }
    const voteData = { ...unsignedVote, signature: await this.#signConsensusMessage(type, unsignedVote) }
    this.#castedVotes.add(voteKey)
    const Message = type === 'prevote' ? PrevoteMessage : PrecommitMessage
    const message = new Message(voteData)
    const payload = message.encoded
    try {
      globalThis.peernet.publish(`consensus:${type}`, payload)
    } catch (e) {
      debug(`peernet publish failed: consensus:${type}`, (e as Error)?.message ?? e)
    }

    if (type === 'prevote') await this.#handlePrevote(payload)
    else await this.#handlePrecommit(payload)
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

      if (!(await this.#verifyConsensusMessage('proposal', msg))) {
        debug(`[consensus] Ignoring proposal with invalid signature from ${from}`)
        return
      }

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

        if (BigInt(blockMessage.decoded.index) !== index) {
          debug(`[consensus] Proposal height ${index} does not match block height ${blockMessage.decoded.index}`)
          return
        }
        if (blockMessage.decoded.producer !== from) {
          debug(`[consensus] Proposal sender ${from} does not match block producer ${blockMessage.decoded.producer}`)
          return
        }

        validateChainLink(localBlock, {
          index: Number(blockMessage.decoded.index),
          hash: actualHash,
          previousHash: String(blockMessage.decoded.previousHash)
        })
        await this.#validateBlockValidators(blockMessage)
        await this.#resolveBlockTransactions(blockMessage)
      } catch (e) {
        debug(`[consensus] Invalid proposed block ${blockHash}:`, (e as Error)?.message)
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

      if (!(await this.#verifyConsensusMessage('prevote', msg))) {
        debug(`[consensus] Ignoring prevote with invalid signature from ${from}`)
        return
      }

      const validators = await this.#getConsensusValidators(Number(index))
      if (!validators.includes(from)) return

      const localBlock = await this.lastBlock
      const localIndex = localBlock?.index !== undefined ? localBlock.index : -1n
      if (index <= localIndex) return

      const voteKey = `${index}:${round}:${blockHash}`
      if (!this.#prevotes.has(voteKey)) this.#prevotes.set(voteKey, new Set())
      this.#prevotes.get(voteKey)!.add(from)

      const threshold = quorumThreshold(validators.length)
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

      if (!(await this.#verifyConsensusMessage('precommit', msg))) {
        debug(`[consensus] Ignoring precommit with invalid signature from ${from}`)
        return
      }

      const validators = await this.#getConsensusValidators(Number(index))
      if (!validators.includes(from)) return
      if (index <= BigInt(this.#committedHeight)) return

      const voteKey = `${index}:${round}:${blockHash}`
      if (!this.#precommits.has(voteKey)) this.#precommits.set(voteKey, new Set())
      this.#precommits.get(voteKey)!.add(from)

      const threshold = quorumThreshold(validators.length)
      const voteCount = this.#precommits.get(voteKey)!.size
      debug(`[consensus] Precommits ${voteKey}: ${voteCount}/${validators.length} (need ${threshold})`)

      const numericIndex = Number(index)
      if (
        voteCount >= threshold &&
        index > BigInt(this.#committedHeight) &&
        !this.#committingHeights.has(numericIndex)
      ) {
        this.#committingHeights.add(numericIndex)

        // Every validator, including the proposer, commits through this exact
        // path. Proposals never mutate canonical chain state before quorum.
        try {
          debug(`[consensus] ✅ Committing block ${blockHash} at height ${index}`)
          const blockData = await globalThis.peernet.get(blockHash, 'block')
          await this.#addBlock(blockData)
          this.#committedHeight = numericIndex
          this.#consensusRound = 0
          if (this.#proposalInFlight?.hash === blockHash) this.#proposalInFlight = null
          if (this.#roundTimer) {
            clearTimeout(this.#roundTimer)
            this.#roundTimer = null
          }

          // Prune vote state only after the canonical state transition succeeds.
          for (const key of [...this.#prevotes.keys()]) {
            if (BigInt(key.split(':')[0]) <= index) this.#prevotes.delete(key)
          }
          for (const key of [...this.#precommits.keys()]) {
            if (BigInt(key.split(':')[0]) <= index) this.#precommits.delete(key)
          }
          for (const key of [...this.#castedVotes]) {
            if (BigInt(key.split(':')[1]) <= index) this.#castedVotes.delete(key)
          }

          // Broadcast committed block so syncing / non-participating nodes can catch up.
          globalThis.peernet.publish('add-block', blockData)
          globalThis.pubsub.publish('add-block', blockData)
        } catch (e) {
          debug(`[consensus] Failed to commit block ${blockHash}:`, (e as Error)?.message)
        } finally {
          this.#committingHeights.delete(numericIndex)
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
    this.addPendingNonce(transaction.decoded.from, transaction.decoded.nonce)
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
      console.log(`raw response for request ${request}:`, response)
      if (response === undefined || response === null) return response

      const normalizeResponse = async (payload: unknown): Promise<unknown> => {
        if (payload === undefined || payload === null) return payload

        if (payload instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(payload))) {
          let bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload)

          for (let i = 0; i < 3; i += 1) {
            try {
              const codec = new Codec(bytes)
              if (codec.name !== 'peernet-response') break

              const wrapped = await new globalThis.peernet.protos['peernet-response'](bytes)
              if (wrapped?.decoded?.response === undefined) break
              const next = wrapped.decoded.response
              if (next instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(next))) {
                bytes = next instanceof Uint8Array ? next : new Uint8Array(next)
                continue
              }
              return normalizeResponse(next)
            } catch {
              break
            }
          }

          try {
            return JSON.parse(new TextDecoder().decode(bytes))
          } catch {
            return bytes
          }
        }

        if (payload && typeof payload === 'object') {
          const objectPayload = payload as Record<string, unknown>
          const decoded = objectPayload.decoded as Record<string, unknown> | undefined
          if ('decoded' in objectPayload && decoded && 'response' in decoded) {
            return normalizeResponse(decoded.response)
          }
          if ('response' in objectPayload) {
            return normalizeResponse(objectPayload.response)
          }
        }

        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload)
          } catch {
            return payload
          }
        }

        return payload
      }

      return await normalizeResponse(response)
    } catch (error) {
      const peerId = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || 'unknown'
      debug(`peernet request failed: ${request} -> ${peerId}:`, (error as Error)?.message ?? error)
      throw error
    }
  }

  async #decodeKnownBlocksResponse(response: any): Promise<{ blocks: string[] } | null> {
    if (!response) return null

    if (Array.isArray(response)) {
      return { blocks: response }
    }

    if (Array.isArray(response.blocks)) {
      return { blocks: response.blocks }
    }

    if (response.response && Array.isArray(response.response.blocks)) {
      return { blocks: response.response.blocks }
    }

    if (typeof response === 'string') {
      try {
        const parsed = JSON.parse(response)
        if (Array.isArray(parsed)) return { blocks: parsed }
        if (parsed && Array.isArray(parsed.blocks)) return { blocks: parsed.blocks }
        if (parsed?.response && Array.isArray(parsed.response.blocks)) return { blocks: parsed.response.blocks }
      } catch {
        return null
      }
      return null
    }

    if (!(response instanceof Uint8Array)) return null

    // Keep knownBlocks decoding binary/codec-first.
    // Some peers may wrap peernet-response more than once, so unwrap up to 3 layers.
    let payload: any = response
    for (let i = 0; i < 3; i++) {
      if (!(payload instanceof Uint8Array)) break
      try {
        const nestedResponse = await new globalThis.peernet.protos['peernet-response'](payload)
        payload = nestedResponse?.decoded?.response
      } catch {
        break
      }
    }

    if (Array.isArray(payload)) return { blocks: payload }
    if (payload && Array.isArray(payload.blocks)) return { blocks: payload.blocks }
    if (payload?.response && Array.isArray(payload.response.blocks)) return { blocks: payload.response.blocks }

    // Backward-compatible fallback for peers returning JSON bytes.
    try {
      const decoded = new TextDecoder().decode(response)
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) return { blocks: parsed }
      if (parsed && Array.isArray(parsed.blocks)) return { blocks: parsed.blocks }
      if (parsed?.response && Array.isArray(parsed.response.blocks)) return { blocks: parsed.response.blocks }
    } catch {
      return null
    }

    return null
  }

  async getPeerTransactionPool(peer) {
    let transactionsInPool = await this.#makeRequest(peer, 'transactionPool')
    console.log('raw response for request transactionPool:', transactionsInPool)
    if (transactionsInPool instanceof Uint8Array) {
      try {
        transactionsInPool = JSON.parse(new TextDecoder().decode(transactionsInPool))
      } catch {
        debug('transactionPool response must be decoded array payload')
        return []
      }
    }
    if (typeof transactionsInPool === 'string') {
      try {
        transactionsInPool = JSON.parse(transactionsInPool)
      } catch {
        return []
      }
    }
    if (!Array.isArray(transactionsInPool)) return []

    // Use Set for O(1) membership checks instead of array.includes
    const localTransactions = new Set(await globalThis.transactionPoolStore.keys())

    const transactionsToGet = []

    for (const key of transactionsInPool) {
      if (!localTransactions.has(key)) {
        let txData
        try {
          txData = await globalThis.peernet.get(key, 'transaction')
        } catch (error) {
          debug(`Failed to get transaction ${key}:`, (error as Error)?.message ?? error)
        }
        if (txData !== undefined) {
          transactionsToGet.push(transactionPoolStore.put(key, txData))
        }
      }
    }
    return Promise.all(transactionsToGet)
  }

  async #peerConnected(peerId) {
    if (typeof peerId !== 'string' || !peerId.trim() || peerId === 'undefined') {
      debug('ignored peer connection without a valid peer id')
      return
    }
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
      const lastBlockRaw = await this.#makeRequest(peer, 'lastBlock')
      console.log('raw last block response:', lastBlockRaw)
      if (lastBlockRaw === undefined || lastBlockRaw === null) {
        throw new Error(`invalid lastBlock payload: ${typeof lastBlockRaw}`)
      }
      const lastBlockMessage = await resolveLastBlockMessage(lastBlockRaw)
      console.log(lastBlockMessage)
      lastBlock = lastBlockMessage.decoded
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

    const higherThenCurrentLocal = localBlock?.index == null ? true : lastBlock.index > localBlock.index

    if (lastBlock) {
      if (!localBlock || higherThenCurrentLocal) {
        try {
          const knownBlocksRaw = await this.#makeRequest(peer, 'knownBlocks')
          const knownBlocksResponse = await this.#decodeKnownBlocksResponse(knownBlocksRaw)
          if (!knownBlocksResponse) {
            debug(
              `knownBlocks decode failed for peer ${peerId} (non-fatal), continuing sync without prefilled wantList`
            )
          } else {
            const MAX_WANTLIST_SIZE = 1000
            const remaining = MAX_WANTLIST_SIZE - this.wantList.length
            if (remaining > 0) {
              for (const hash of knownBlocksResponse.blocks.slice(0, remaining)) {
                this.wantList.push(hash)
              }
            }
          }
        } catch (error) {
          const peerName = (peer as any)?.peerId || (peer as any)?.id || (peer as any)?.address || peerId || 'unknown'
          debug(
            `knownBlocks request failed: ${peerName} (non-fatal), continuing sync without prefilled wantList:`,
            (error as Error)?.message ?? error
          )
        }
      }
    }

    if (this.wantList.length > 0) {
      const promises = await Promise.allSettled(this.wantList.map((hash) => peernet.get(hash, 'block')))
      for (let i = promises.length - 1; i >= 0; i -= 1) {
        if (promises[i].status === 'fulfilled') this.wantList.splice(i, 1)
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
        const decodedStateInfo = new StateMessage(stateInfo).decoded as {
          values?: Record<string, unknown>
        }
        stateInfo = decodedStateInfo?.values ?? decodedStateInfo
      }
      debug(
        `sync start with peer ${peerId}: local=${localBlock?.index ?? -1} remote=${lastBlock?.index ?? -1} hash=${
          lastBlock?.hash
        }`
      )
      await this.syncChain(lastBlock)
      debug(
        `sync finished with peer ${peerId}: state=${this.syncState} localNow=${(await this.lastBlock)?.index ?? -1}`
      )
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
    const blockIndex = Number(blockMessage.decoded.index)
    const linkResult = validateChainLink(await this.lastBlock, {
      index: blockIndex,
      hash,
      previousHash: String(blockMessage.decoded.previousHash)
    })
    if (linkResult !== 'append') {
      debug(`Ignoring ${linkResult} block ${hash} at height ${blockIndex}`)
      return
    }

    // Verify data integrity
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
    await this.#validateBlockValidators(blockMessage)

    // NOW SAFE TO PROCEED with transaction processing
    // Authenticate both the content-addressed reference and transaction sender
    // before storing the block or mutating the local transaction pool.
    const transactions = await this.#resolveBlockTransactions(blockMessage)
    await Promise.all(
      blockMessage.decoded.transactions.map(async (transactionHash) => {
        if (await transactionPoolStore.has(transactionHash)) await transactionPoolStore.delete(transactionHash)
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
      const nonceDiff = compareTransactionNonces(a.decoded?.nonce, b.decoded?.nonce)
      if (nonceDiff !== 0) return nonceDiff
      // Tertiary: in stable order (insertion order preserved)
      return 0
    })

    // Contract calls share global state, so every node must execute the complete
    // block in exactly the same order regardless of sender.
    for (const transaction of allTransactions) {
      if (!contracts.includes(transaction.decoded.to)) contracts.push(transaction.decoded.to)
      this.removePendingNonce(transaction.decoded.from, transaction.decoded.nonce)
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
        await this.sendTransaction(transaction)
        this.#participating = false
        return false
      }
    } catch (error) {
      this.#participating = false
      throw new Error(`validator participation failed: ${(error as Error)?.message ?? error}`)
    }
    this.#participating = true
    if ((await this.hasTransactionToHandle()) && !this.#runningEpoch && this.#participating) await this.#runEpoch()
    return true
  }

  async #handleTransaction(transaction, latestTransactions, block?) {
    await this.validateTransactionSignature(transaction)
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
    if (this.#proposalInFlight) return

    // vote for transactions
    if ((await globalThis.transactionPoolStore.size()) === 0) return

    let transactions = await globalThis.transactionPoolStore.values(this.transactionLimit)

    if (Object.keys(transactions)?.length === 0) return

    const timestamp = Date.now()

    const block: any = {
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

    // A transaction that already exists in canonical state is not pending.
    // Prune it before signature validation so stale pools cannot repeatedly
    // decode and validate the same transactions forever.
    const pendingTransactions = await pruneCanonicalTransactions(
      transactions,
      latestTransactions,
      (hash) => globalThis.transactionStore.has(hash),
      (hash) => globalThis.transactionPoolStore.delete(hash)
    )

    // Combine priority and normal transactions, then sort deterministically
    const allTransactions = pendingTransactions.sort((a, b) => {
      // Primary: by priority (true first)
      if (a.transaction.decoded.priority !== b.transaction.decoded.priority) {
        return (b.transaction.decoded.priority ? 1 : 0) - (a.transaction.decoded.priority ? 1 : 0)
      }
      // Secondary: by nonce
      const nonceDiff = compareTransactionNonces(a.transaction.decoded?.nonce, b.transaction.decoded?.nonce)
      if (nonceDiff !== 0) return nonceDiff
      // Tertiary: in stable order (insertion order preserved)
      return 0
    })

    // A proposal only validates and publishes transaction data. Canonical
    // execution happens in #addBlock after quorum is reached.
    for (const { transaction, hash } of allTransactions) {
      await this.validateTransactionSignature(transaction)
      block.transactions.push(hash)
      block.fees += BigInt(await calculateFee(transaction.decoded))
      await globalThis.peernet.put(hash, transaction.encoded, 'transaction')
    }

    // don't add empty block
    if (block.transactions.length === 0) return

    const localBlock = await this.lastBlock
    block.index = nextBlockIndex(localBlock?.index)

    block.previousHash = localBlock.hash || '0x0'
    // block.timestamp = Date.now()
    // block.reward = block.reward.toString()
    // block.fees = block.fees.toString()

    // CRITICAL FIX: Sort validators deterministically to avoid encoding divergence
    // Use canonical validator set from contract, sorted by address
    const canonicalValidators = (await this.staticCall(addresses.validators, 'validators')) as Validators['validators']
    const sortedValidators = [...canonicalValidators].sort()

    if (sortedValidators.length === 0) throw new Error('cannot produce a block without validators')

    // Apply reward to all canonical validators (deterministic)
    block.validators = sortedValidators.map((validatorAddress) => ({
      address: validatorAddress,
      reward: block.fees / BigInt(sortedValidators.length) + block.reward / BigInt(sortedValidators.length)
    }))

    try {
      // Set producer to current account
      block.producer = globalThis.peernet.selectedAccount || ''

      // Sign deterministic block bytes (without producerProof) to avoid JSON encoding.
      const producerSigner = globalThis.peernet?.identity
      if (block.producer && producerSigner) {
        const unsignedBlockMessage = await new BlockMessage({ ...block, producerProof: '' })
        const unsignedBlockHash = await unsignedBlockMessage.hash()
        const signedProof = await signTransaction(
          {
            from: block.producer,
            to: addresses.validators,
            method: 'produceBlock',
            params: [unsignedBlockHash],
            timestamp: block.timestamp
          },
          producerSigner
        )
        block.producerProof = signedProof.signature
      }

      if (!block.producer || !block.producerProof) throw new Error('block producer identity is not available')

      let blockMessage = await new BlockMessage(block)

      const hash = await blockMessage.hash()

      await globalThis.peernet.put(hash, blockMessage.encoded, 'block')
      this.#proposalInFlight = { hash, index: block.index, round: this.#consensusRound }
      debug(`proposed block: ${hash} @${block.index}`)

      // Phase 2: announce proposal for consensus voting instead of direct add-block
      console.log(`[consensus] 📤 Proposing block #${block.index} | hash: ${hash} | round: ${this.#consensusRound}`)
      const unsignedProposal = {
        blockHash: hash,
        index: BigInt(block.index),
        round: BigInt(this.#consensusRound),
        from: peernet.selectedAccount
      }
      const proposalData = {
        ...unsignedProposal,
        signature: await this.#signConsensusMessage('proposal', unsignedProposal)
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

      if (!this.#roundTimer && this.#proposalInFlight?.hash === hash) {
        this.#roundTimer = setTimeout(async () => {
          this.#roundTimer = null
          if (this.#proposalInFlight?.hash !== hash) return
          this.#proposalInFlight = null
          this.#consensusRound += 1
          this.#runningEpoch = false
          if (this.#participating) await this.#runEpoch()
        }, this.#slotTime)
      }
    } catch (error) {
      console.log(error)

      throw new Error(`invalid block ${block}`)
    }
    // data = await this.machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  async #sendTransaction(transaction) {
    transaction = await new TransactionMessage(transaction.encoded || transaction)
    await this.validateTransactionSignature(transaction)
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

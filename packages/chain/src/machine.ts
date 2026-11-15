import addresses, { contractFactory } from '@leofcoin/addresses'
import { chainNetwork } from './ledger-network.js'
import { randombytes } from '@leofcoin/crypto'
import EasyWorker from '@leofcoin/workers/binary-worker'
import { ContractMessage } from '@leofcoin/messages'
import { ExecutionError, ContractDeploymentError } from '@leofcoin/errors'
import { createDebugger } from '@vandeurenglenn/debug'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { writeCheckpoint, type Checkpoint, type CheckpointSnapshot } from './helpers/state-checkpoint.js'
import { ReadOnlyMachine, type ReadSeed } from './read-only-machine.js'
import type { TransactionExecution } from '@leofcoin/workers/machine-worker'
import { assertPqGenesis, type PqGenesis } from '@leofcoin/lib/pq-genesis'
import { BlockMessage } from '@leofcoin/messages'
import type { BlockInMemory, ChainTip } from './types.js'

type WorkerEvent =
  | { type: 'ask'; id: string; question: 'staticCall'; input: { snapshot: ReadSeed; contract: string; method: string; params: unknown[]; sender: string } }
  | { type: 'ask'; id: string; question: 'contract' | 'transaction'; input: string }
  | { type: 'ask'; id: string; question: 'peers'; input: unknown }
  | { type: 'contractError'; hash: string; message?: string; error?: unknown }
  | { type: 'initError' | 'executeError' | 'addLoadedBlockError' | 'runContractError' | 'collectFeeError' | 'settleRewardsError' | 'executeTransactionsError' | 'snapshotError' | 'getError'; id: string; message: string; transactionHash?: string }
  | { type: 'debug' | 'error'; message: string }
  | { type: 'response'; id: string; value: unknown }
  | { type: 'addToWantList'; hash: string }

const responseError = (message: unknown): unknown =>
  message && typeof message === 'object' && 'error' in message ? message.error : undefined
const genesisContracts = { contractFactory: addresses.contractFactory, nativeToken: addresses.nativeToken,
  nameService: addresses.nameService, validators: addresses.validators }
// import State from './state'
const debug = createDebugger('leofcoin/machine')
export default class Machine {
  worker!: EasyWorker

  states: Omit<CheckpointSnapshot, 'chainId'> = {
    states: {},
    lastBlock: {
      index: -1,
      hash: '0x0'
    },
    accounts: {},
    info: {
      nativeCalls: BigInt(0),
      nativeMints: BigInt(0),
      nativeBurns: BigInt(0),
      nativeTransfers: BigInt(0),
      totalBurnAmount: BigInt(0),
      totalMintAmount: BigInt(0),
      totalTransferAmount: BigInt(0),
      totalTransactions: BigInt(0),
      totalBlocks: BigInt(0)
    }
  }

  wantList: string[] = []

  readyResolve!: (value: Machine | PromiseLike<Machine>) => void
  readyReject!: (reason: unknown) => void
  ready = new Promise<Machine>((resolve, reject) => {
    this.readyResolve = resolve
    this.readyReject = reject
  })
  #checkpointGeneration = -1
  #chainId!: string
  #reader!: ReadOnlyMachine
  #contractReader!: ReadOnlyMachine
  #readSnapshot?: ReadSeed
  #workerPath!: string
  #closed = false

  close() {
    this.#closed = true
    this.#reader?.close()
    this.#contractReader?.close()
    this.worker?.terminate()
  }

  constructor(blocks: BlockInMemory[] = [], checkpoint?: Checkpoint, private genesis?: PqGenesis) {
    if (genesis) assertPqGenesis(genesis)
    this.init(blocks, checkpoint).then(() => this.readyResolve(this), error => {
      this.close()
      this.readyReject(error)
    })
  }

  async init(blocks: BlockInMemory[], checkpoint?: Checkpoint) {
    return this.#init(blocks, checkpoint)
  }

  async #onmessage(data: WorkerEvent) {
    if (this.#closed) return
    switch (data.type) {
      case 'contractError': {
        console.warn(data.message ?? data.error)

        console.warn(`contract error: ${data.hash}`)

        break
      }

      case 'initError': {
        pubsub.publish(data.id, { error: new Error(`Machine initialization failed: ${data.message}`) })
        break
      }

      case 'executeError': {
        // console.warn(`error executing transaction ${data.message}`);
        pubsub.publish(data.id, { error: data.message })
        break
      }

      case 'addLoadedBlockError':
      case 'runContractError':
      case 'collectFeeError':
      case 'settleRewardsError': {
        pubsub.publish(data.id, { error: new Error(data.message) })
        break
      }
      case 'executeTransactionsError': {
        pubsub.publish(data.id, { error: Object.assign(new ExecutionError(data.message), {
          transactionHash: data.transactionHash
        }) })
        break
      }
      case 'snapshotError': {
        pubsub.publish(data.id, { error: new Error(data.message) })
        break
      }
      case 'getError': {
        pubsub.publish(data.id, { error: new Error(data.message) })
        break
      }

      case 'debug': {
        // debug(data.message)
        if (data.message.includes('loaded transactions for block:')) {
          pubsub.publish('block-loaded', data.message.replace('loaded transactions for block: ', '').split(' @')[0])
        }
        break
      }
      case 'error': {
        console.error(data.message)
        break
      }
      case 'response': {
        pubsub.publish(data.id, data.value ?? false)
        break
      }
      case 'addToWantList': {
        if (!this.wantList.includes(data.hash)) this.wantList.push(data.hash)
        break
      }
      case 'ask': {
        if (data.question === 'staticCall') {
          try {
            const { snapshot, contract, method, params, sender } = data.input
            const input = await this.#contractReader.read(snapshot, contract, method, params, sender)
            if (!this.#closed) this.worker.postMessage({ id: data.id, input })
          } catch (error) {
            if (!this.#closed) this.worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) })
          }
          break
        }
        if (data.question === 'contract' || data.question === 'transaction') {
          try {
            const input = await peernet.get(data.input, data.question)
            if (input === undefined) {
              this.worker.postMessage({ id: data.id, error: `could not get ${data.question} @${data.input}` })
              this.wantList.push(data.input)
            } else {
              this.worker.postMessage({ id: data.id, input })
            }
          } catch (error) {
            console.error(error)

            this.worker.postMessage({ id: data.id, error: `could not get ${data.question} @${data.input}` })
            this.wantList.push(data.input)
          }
        } else if (data.question === 'peers') {
          this.worker.postMessage({
            id: data.id,
            input: peernet.connections ? Object.values(peernet.connections).map(peer => {
              if (!('toJSON' in peer) || typeof peer.toJSON !== 'function') throw new Error('Peer cannot be serialized')
              return peer.toJSON()
            }) : []
          })
        } else {
          this.worker.postMessage({ id: data.id, input: data.input })
        }
      }
    }
  }

  async updateState(strict = false) {
    try {
      const snapshot = await this.#askWorker('snapshot')
      snapshot.chainId = this.#chainId
      const accounts: Record<string, string> = {}
      for (const address of await accountsStore.keys()) {
        const raw = await accountsStore.get(address)
        accounts[address] = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
      }
      snapshot.accounts = accounts
      const generation = this.#checkpointGeneration + 1
      await writeCheckpoint(stateStore, snapshot, generation, Object.values(this.genesis?.addresses ?? genesisContracts))
      // Advance the in-memory durable tip only after the complete record succeeds.
      this.#checkpointGeneration = generation
      this.states = snapshot
      this.#readSnapshot = structuredClone(snapshot)
    } catch (error) {
      if (strict) throw error
      console.error(error)
      throw error
    }
  }

  async #init(blocks: BlockInMemory[], checkpoint?: Checkpoint): Promise<void> {
    const identity = await createChainIdentity(this.genesis ? 'leofcoin:pq' : chainNetwork(), this.genesis?.addresses ?? addresses)
    this.#chainId = identity.chainId
    if (checkpoint) {
      this.#checkpointGeneration = checkpoint.generation
      this.states = checkpoint.snapshot
    }
    let pre = './'
    try {
      const { fileURLToPath } = await import('url')
      pre = fileURLToPath(new URL('.', import.meta.url))
    } catch { /* browser worker URL */ }
    this.#workerPath = pre + '@leofcoin/workers/machine-worker.js'
    const readContract = (hash: string) => globalThis.contractStore.get(hash)
    this.#reader = new ReadOnlyMachine(this.#workerPath, readContract, this.genesis)
    this.#contractReader = new ReadOnlyMachine(this.#workerPath, readContract, this.genesis)
    this.worker = await new EasyWorker(this.#workerPath, {
      serialization: 'advanced', type: 'module'
    })
    if (this.#closed) { this.worker.terminate(); throw new Error('State machine is closed') }
    this.worker.onmessage(this.#onmessage.bind(this))
    const initialized = await this.#askWorker('init', {
      blocks,
      genesis: this.genesis,
      fromState: Boolean(checkpoint),
      lastBlock: checkpoint?.snapshot.lastBlock,
      state: checkpoint?.snapshot.states,
      info: checkpoint?.snapshot.info,
      peerid: peernet.peerId
    })
    if (initialized !== true) throw new Error('Worker does not support checkpoint initialization; deploy matching chain and worker builds')
    this.#readSnapshot = structuredClone(checkpoint?.snapshot ?? await this.#askWorker('snapshot'))
  }

  async #runContract(contractMessage: ContractMessage) {
    const hash = await contractMessage.hash()
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const onmessage = (message: unknown) => {
        pubsub.unsubscribe(id, onmessage)

        const error = responseError(message)
        if (error) reject(error)
        else resolve(message)
      }
      pubsub.subscribe(id, onmessage)
      this.worker.postMessage({
        type: 'run',
        id,
        input: {
          decoded: contractMessage.decoded,
          encoded: contractMessage.encoded,
          hash
        }
      })
    })
  }

  /**
   *
   * @param {Address} contract
   * @param {String} method
   * @param {Array} parameters
   * @returns Promise<message>
   */
  async execute(
    contract: string,
    method: string,
    parameters: unknown[],
    sender?: string,
    execution?: { randomness?: string; seed?: string; timestamp?: number }
  ): Promise<any> {
    if (this.#closed) throw new Error('State machine is closed')
    try {
      if (contract === (this.genesis?.addresses.contractFactory ?? contractFactory) && method === 'registerContract') {
        if (typeof parameters[0] !== 'string') throw new Error('contract hash required')
        if (await this.has(parameters[0])) throw new Error(`duplicate contract @${parameters[0]}`)
        let message
        if (!(await globalThis.contractStore.has(parameters[0]))) {
          message = await peernet.get(parameters[0], 'contract')
          if (!message) throw new Error(`contract ${parameters[0]} not available`)
          message = await new ContractMessage(message)
          await globalThis.contractStore.put(await message.hash(), message.encoded)
        }
        if (!message) {
          message = await globalThis.contractStore.get(parameters[0])
          message = await new ContractMessage(message)
        }
        if (!(await this.has(await message.hash()))) await this.#runContract(message)
      }
    } catch (error) {
      throw new ContractDeploymentError(`contract deployment failed for ${parameters[0]}\n${error instanceof Error ? error.message : String(error)}`)
    }
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const timeout = setTimeout(() => {
        pubsub.unsubscribe(id, onmessage)
        reject(new Error(`Machine.execute timeout for ${contract}.${method}`))
      }, 30000) // 30 second timeout for machine operations

      const onmessage = (message: unknown) => {
        clearTimeout(timeout)
        pubsub.unsubscribe(id, onmessage)

        const error = responseError(message)
        if (error) reject(new ExecutionError(String(error)))
        else resolve(message)
      }
      pubsub.subscribe(id, onmessage)
      this.worker.postMessage({
        type: 'execute',
        id,
        input: {
          to: contract,
          contract,
          method,
          params: parameters,
          sender,
          executionSeed: execution?.seed,
          executionTimestamp: execution?.timestamp,
          executionRandomness: execution?.randomness
        }
      })
    })
  }

  collectFee(from: string, payments: Array<{ to: string; amount: bigint }>, burned: bigint): Promise<bigint> {
    return this.#askWorker('collectFee', { from, payments, burned })
  }

  async executeTransactions(transactions: TransactionExecution[]): Promise<void> {
    const result = await this.#askWorker('executeTransactions', transactions, 30_000 * Math.max(1, transactions.length))
    if (result !== true) throw new Error('Worker did not acknowledge transaction execution batch')
  }

  settleRewards(rewards: Array<[string, bigint]>): Promise<bigint> {
    return this.#askWorker('settleRewards', { rewards })
  }

  get(contract: string, method: string, parameters?: unknown[]) {
    if (!this.#readSnapshot) return Promise.reject(new Error('Contract read state is not initialized'))
    return this.#reader.read(this.#readSnapshot, contract, method, parameters ?? [])
  }

  async has(address: string) {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const timeout = setTimeout(() => {
        pubsub.unsubscribe(id, onmessage)
        reject(new Error(`Machine.has timeout for ${address}`))
      }, 10000) // 10 second timeout

      const onmessage = (message: unknown) => {
        clearTimeout(timeout)
        pubsub.unsubscribe(id, onmessage)
        const error = responseError(message)
        if (error) reject(error)
        else resolve(message)
      }
      pubsub.subscribe(id, onmessage)
      this.worker.postMessage({
        type: 'has',
        id,
        input: {
          address
        }
      })
    })
  }

  #askWorker(type: string, input?: unknown, timeoutMs = 30_000): Promise<any> {
    if (this.#closed) return Promise.reject(new Error('State machine is closed'))
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const timeout = setTimeout(() => {
        pubsub.unsubscribe(id, onmessage)
        reject(new Error(`Machine.#askWorker timeout for ${type}`))
      }, timeoutMs)

      const onmessage = (message: unknown) => {
        clearTimeout(timeout)
        pubsub.unsubscribe(id, onmessage)
        const error = responseError(message)
        if (error) reject(error)
        else resolve(message)
      }
      pubsub.subscribe(id, onmessage)
      this.worker.postMessage({
        type,
        id,
        input
      })
    })
  }

  get contracts() {
    return this.#askWorker('contracts')
  }

  get totalContracts() {
    return this.#askWorker('totalContracts')
  }

  get nativeCalls() {
    return this.#askWorker('nativeCalls')
  }

  get nativeMints() {
    return this.#askWorker('nativeMints')
  }

  get nativeBurns() {
    return this.#askWorker('nativeBurns')
  }

  get nativeTransfers() {
    return this.#askWorker('nativeTransfers')
  }

  get totalBurnAmount() {
    return this.#askWorker('totalBurnAmount')
  }

  get totalMintAmount() {
    return this.#askWorker('totalMintAmount')
  }

  get totalMintAmountWithRewards() {
    return this.#askWorker('totalMintAmountWithRewards', undefined, 5000)
  }

  get totalTransferAmount() {
    return this.#askWorker('totalTransferAmount')
  }

  get totalTransactions() {
    return this.#askWorker('totalTransactions')
  }

  get totalBlocks() {
    return this.#askWorker('totalBlocks')
  }

  get blocks() {
    return this.getBlocks()
  }

  get lastBlock(): Promise<ChainTip> {
    // Public/status reads never advertise a tip whose checkpoint has not committed.
    return Promise.resolve(this.states.lastBlock)
  }

  getCanonicalTip(): Promise<any> {
    return this.#askWorker('lastBlock')
  }

  get lastBlockHeight() {
    return Promise.resolve(Number(this.states.lastBlock.index))
  }

  getBlocks(from?: number, to?: number): Promise<[]> {
    return this.#askWorker('blocks', { from, to })
  }

  getBlock(index: number) {
    return this.#askWorker('block', index)
  }

  async addLoadedBlock(block: BlockInMemory | BlockMessage) {
    const loaded: BlockInMemory = 'decoded' in block ? { ...block.decoded, hash: await block.hash() } : block
    debug(`adding loaded block: ${loaded.index}@${loaded.hash}`)
    return this.#askWorker('addLoadedBlock', loaded)
  }

  async latestTransactions() {
    return this.#askWorker('latestTransactions')
  }

  async delete(hash: string) {
    return globalThis.contractStore.delete(hash)
  }

  /**
   *
   * @returns Promise
   */
  async deleteAll() {
    const hashes = await globalThis.contractStore.keys()
    return Promise.all(Object.keys(hashes).map((hash) => this.delete(hash)))
  }
}

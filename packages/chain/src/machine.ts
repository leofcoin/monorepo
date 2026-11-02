import addresses, { contractFactory } from '@leofcoin/addresses'
import { randombytes } from '@leofcoin/crypto'
import EasyWorker from '@leofcoin/workers/binary-worker'
import { ContractMessage } from '@leofcoin/messages'
import { ExecutionError, ContractDeploymentError } from '@leofcoin/errors'
import { createDebugger } from '@vandeurenglenn/debug'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { writeCheckpoint } from './helpers/state-checkpoint.js'
import { ReadOnlyMachine } from './read-only-machine.js'
const genesisContracts = { contractFactory: addresses.contractFactory, nativeToken: addresses.nativeToken,
  nameService: addresses.nameService, validators: addresses.validators }
// import State from './state'
const debug = createDebugger('leofcoin/machine')
export default class Machine {
  worker: EasyWorker

  states = {
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

  readyResolve: (value: Machine | PromiseLike<Machine>) => void
  readyReject: (reason: unknown) => void
  ready = new Promise<Machine>((resolve, reject) => {
    this.readyResolve = resolve
    this.readyReject = reject
  })
  #checkpointGeneration = -1
  #chainId: string
  #reader: ReadOnlyMachine
  #contractReader: ReadOnlyMachine
  #readSnapshot
  #workerPath: string
  #closed = false

  close() {
    this.#closed = true
    this.#reader?.close()
    this.#contractReader?.close()
    this.worker?.terminate()
  }

  constructor(blocks: any[] = [], checkpoint?) {
    this.init(blocks, checkpoint).then(() => this.readyResolve(this), error => {
      this.close()
      this.readyReject(error)
    })
  }

  async init(blocks, checkpoint?) {
    return this.#init(blocks, checkpoint)
  }

  async #onmessage(data) {
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
            input: peernet.connections ? Object.entries(peernet.connections).map(([id, peer]) => peer.toJSON()) : []
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
      const accounts = {}
      for (const address of await accountsStore.keys()) {
        const raw = await accountsStore.get(address)
        accounts[address] = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
      }
      snapshot.accounts = accounts
      const generation = this.#checkpointGeneration + 1
      await writeCheckpoint(stateStore, snapshot, generation, Object.values(genesisContracts))
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

  async #init(blocks, checkpoint?): Promise<void> {
    const identity = await createChainIdentity(globalThis.peernet?.network || 'leofcoin:peach', addresses)
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
    const readContract = hash => globalThis.contractStore.get(hash)
    this.#reader = new ReadOnlyMachine(this.#workerPath, readContract)
    this.#contractReader = new ReadOnlyMachine(this.#workerPath, readContract)
    this.worker = await new EasyWorker(this.#workerPath, {
      serialization: 'advanced', type: 'module'
    })
    if (this.#closed) { this.worker.terminate(); throw new Error('State machine is closed') }
    this.worker.onmessage(this.#onmessage.bind(this))
    const initialized = await this.#askWorker('init', {
      blocks,
      fromState: Boolean(checkpoint),
      lastBlock: checkpoint?.snapshot.lastBlock,
      state: checkpoint?.snapshot.states,
      info: checkpoint?.snapshot.info,
      peerid: peernet.peerId
    })
    if (initialized !== true) throw new Error('Worker does not support checkpoint initialization; deploy matching chain and worker builds')
    this.#readSnapshot = structuredClone(checkpoint?.snapshot ?? await this.#askWorker('snapshot'))
  }

  async #runContract(contractMessage) {
    const hash = await contractMessage.hash()
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const onmessage = (message) => {
        pubsub.unsubscribe(id, onmessage)

        if (message?.error) reject(message.error)
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
    contract,
    method,
    parameters,
    sender?: string,
    execution?: { randomness?: string; seed?: string; timestamp?: number }
  ): Promise<any> {
    if (this.#closed) throw new Error('State machine is closed')
    try {
      if (contract === contractFactory && method === 'registerContract') {
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
      throw new ContractDeploymentError(`contract deployment failed for ${parameters[0]}\n${error.message}`)
    }
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const timeout = setTimeout(() => {
        pubsub.unsubscribe(id, onmessage)
        reject(new Error(`Machine.execute timeout for ${contract}.${method}`))
      }, 30000) // 30 second timeout for machine operations

      const onmessage = (message) => {
        clearTimeout(timeout)
        pubsub.unsubscribe(id, onmessage)

        if (message?.error) reject(new ExecutionError(message.error))
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

  settleRewards(rewards: Array<[string, bigint]>): Promise<bigint> {
    return this.#askWorker('settleRewards', { rewards })
  }

  get(contract, method, parameters?) {
    if (!this.#readSnapshot) return Promise.reject(new Error('Contract read state is not initialized'))
    return this.#reader.read(this.#readSnapshot, contract, method, parameters ?? [])
  }

  async has(address) {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const timeout = setTimeout(() => {
        pubsub.unsubscribe(id, onmessage)
        reject(new Error(`Machine.has timeout for ${address}`))
      }, 10000) // 10 second timeout

      const onmessage = (message) => {
        clearTimeout(timeout)
        pubsub.unsubscribe(id, onmessage)
        if (message?.error) reject(message.error)
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

  #askWorker(type, input?): Promise<any> {
    if (this.#closed) return Promise.reject(new Error('State machine is closed'))
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const timeout = setTimeout(() => {
        pubsub.unsubscribe(id, onmessage)
        reject(new Error(`Machine.#askWorker timeout for ${type}`))
      }, 30000)

      const onmessage = (message) => {
        clearTimeout(timeout)
        pubsub.unsubscribe(id, onmessage)
        if (message?.error) reject(message.error)
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

  get lastBlock() {
    // Public/status reads never advertise a tip whose checkpoint has not committed.
    return Promise.resolve(this.states.lastBlock)
  }

  getCanonicalTip(): Promise<any> {
    return this.#askWorker('lastBlock')
  }

  get lastBlockHeight() {
    return Promise.resolve(Number(this.states.lastBlock.index))
  }

  getBlocks(from?, to?): Promise<[]> {
    return this.#askWorker('blocks', { from, to })
  }

  getBlock(index) {
    return this.#askWorker('block', index)
  }

  async addLoadedBlock(block) {
    debug(`adding loaded block: ${block.index}@${block.hash}`)
    if (block.decoded) block = { ...block.decoded, hash: await block.hash() }
    return this.#askWorker('addLoadedBlock', block)
  }

  async latestTransactions() {
    return this.#askWorker('latestTransactions')
  }

  async delete(hash) {
    return globalThis.contractStore.delete(hash)
  }

  /**
   *
   * @returns Promise
   */
  async deleteAll() {
    let hashes = await globalThis.contractStore.keys()
    hashes = Object.keys(hashes).map((hash) => this.delete(hash))
    return Promise.all(hashes)
  }
}

import { contractFactory, nativeToken, validators, nameService } from '@leofcoin/addresses'
import { randombytes } from '@leofcoin/crypto'
import EasyWorker from '@vandeurenglenn/easy-worker'
import { ContractMessage } from '@leofcoin/messages'
import { ExecutionError, ContractDeploymentError } from '@leofcoin/errors'
import { formatBytes } from '@leofcoin/utils'
import { RawBlock } from './types.js'
// import State from './state'
const debug = globalThis.createDebugger('leofcoin/machine')
export default class Machine {
  worker: EasyWorker
  #contracts = {}
  #nonces = {}

  states = {
    states: {},
    lastBlock: {
      index: 0,
      hash: ''
    }
  }

  constructor(blocks) {
    // @ts-ignore
    return this.#init(blocks)
  }

  #createMessage(sender = peernet.selectedAccount) {
    return {
      sender,
      call: this.execute,
      staticCall: this.get.bind(this)
    }
  }

  async #onmessage(data) {
    switch (data.type) {
      case 'transactionLoaded': {
        const { from, nonce, hash } = data.result
        ;(await transactionPoolStore.has(hash)) && (await transactionPoolStore.delete(hash))
        try {
          const _nonce = await accountsStore.get(from)
          if (nonce > _nonce) await accountsStore.put(from, nonce)
        } catch (error) {
          await accountsStore.put(from, nonce)
        }
        break
      }
      case 'contractError': {
        console.warn(data.error)

        console.warn(`contract error: ${data.hash}`)

        // @ts-ignore
        await contractStore.delete(data.hash)
        break
      }

      case 'initError': {
        console.error(`init error: ${data.message}`)
        break
      }

      case 'executionError': {
        // console.warn(`error executing transaction ${data.message}`);
        pubsub.publish(data.id, { error: data.message })
        break
      }

      case 'debug': {
        debug(data.message)
        if (data.message.includes('loaded transactions for block:')) {
          pubsub.publish('block-loaded', data.message.replace('loaded transactions for block: ', '').split(' @')[0])
        }
        break
      }
      case 'error': {
        console.error(data.message)
        break
      }
      case 'machine-ready': {
        pubsub.publish('machine.ready', true)
        break
      }
      case 'response': {
        pubsub.publish(data.id, data.value || false)
        break
      }
    }
  }

  async updateState() {
    try {
      if ((await this.lastBlock).index > this.states.lastBlock.index) {
        // todo only get state for changed contracts
        const blocks = (await this.blocks).slice(this.states.lastBlock.index)
        const contractsToGet = blocks.reduce((set, current: RawBlock) => {
          for (const transaction of current.transactions) {
            const contract = transaction.to
            if (!set.includes(contract)) set.push(contract)
          }

          return set
        }, [])
        const state = {}
        await Promise.all(
          contractsToGet.map(async (contract) => {
            const value = await this.#askWorker('get', { contract, method: 'state', params: [] })
            state[contract] = value
          })
        )
        await stateStore.put('lastblock', JSON.stringify(await this.lastBlock))
        await stateStore.put('states', JSON.stringify(state))
      }
    } catch (error) {
      console.error(error)
    }
  }

  async #init(blocks): Promise<Machine> {
    return new Promise(async (resolve) => {
      const machineReady = async () => {
        pubsub.unsubscribe('machine.ready', machineReady)
        await this.updateState()
        resolve(this)
      }
      pubsub.subscribe('machine.ready', machineReady)

      let pre: string

      try {
        const importee = await import('url')
        const url = importee.default
        if (url) pre = url.fileURLToPath(new URL('.', import.meta.url))
      } catch {
        // browser env
        pre = './'
      }

      this.worker = await new EasyWorker(pre + '@leofcoin/workers/machine-worker.js', {
        serialization: 'advanced',
        type: 'module'
      })
      this.worker.onmessage(this.#onmessage.bind(this))

      let contracts = []
      if (await stateStore.has('lastBlock')) {
        this.states.lastBlock = JSON.parse(new TextDecoder().decode(await stateStore.get('lastBlock')))
        this.states.states = JSON.parse(new TextDecoder().decode(await stateStore.get('states')))
        const entries = Object.entries(this.states.states)
        if (entries.length > 0) {
          console.log(this.states.lastBlock)

          const promises = []
          for (const [address, value] of entries) {
            const setState = async (address, value) => {
              const contractBytes = await globalThis.contractStore.get(address)
              const contract = await new ContractMessage(contractBytes)
              const params = contract.decoded.constructorParameters
              const hash = await contract.hash()
              try {
                const func = new Function(new TextDecoder().decode(contract.decoded.contract))
                const Contract = func()
                params.push(value)
                globalThis.msg = this.#createMessage(contract.decoded.creator)
                contracts[hash] = await new Contract(...params)
                debug(`loaded contract: ${hash} size: ${formatBytes(contract.encoded.length)}`)
              } catch (e) {
                console.log(e)
                this.#onmessage({
                  type: 'contractError',
                  message: e.message,
                  hash
                })
              }
            }
            promises.push(setState(address, value))
          }
          await Promise.all(promises)
        }
      }
      console.log({ contracts })

      // const blocks = await blockStore.values()
      contracts = await Promise.all([
        globalThis.contractStore.get(contractFactory),
        globalThis.contractStore.get(nativeToken),
        globalThis.contractStore.get(validators),
        globalThis.contractStore.get(nameService)
      ])

      const message = {
        type: 'init',
        input: {
          contracts,
          blocks,
          // @ts-ignore
          peerid: peernet.peerId
        }
      }
      this.worker.postMessage(message)
    })
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
  async execute(contract, method, parameters): Promise<any> {
    try {
      if (contract === contractFactory && method === 'registerContract') {
        if (await this.has(parameters[0])) throw new Error(`duplicate contract @${parameters[0]}`)
        let message
        if (!(await globalThis.contractStore.has(parameters[0]))) {
          message = await peernet.get(parameters[0], 'contract')
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
      const onmessage = (message) => {
        pubsub.unsubscribe(id, onmessage)
        if (message?.error) reject(new ExecutionError(message.error))
        else resolve(message)
      }
      pubsub.subscribe(id, onmessage)
      this.worker.postMessage({
        type: 'execute',
        id,
        input: {
          contract,
          method,
          params: parameters
        }
      })
    })
  }

  get(contract, method, parameters?): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = randombytes(20).toString()
      const onmessage = (message) => {
        pubsub.unsubscribe(id, onmessage)
        resolve(message)
      }
      pubsub.subscribe(id, onmessage)
      this.worker.postMessage({
        type: 'get',
        id,
        input: {
          contract,
          method,
          params: parameters
        }
      })
    })
  }

  async has(address) {
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
        type: 'has',
        id,
        input: {
          address
        }
      })
    })
  }

  #askWorker(type, input?): Promise<any> {
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
        type,
        id,
        input
      })
    })
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

  get totalTransactions() {
    return this.#askWorker('totalTransactions')
  }

  get blocks() {
    return this.getBlocks()
  }

  get lastBlock() {
    return this.#askWorker('lastBlock')
  }

  get totalBlocks() {
    return this.#askWorker('totalBlocks')
  }

  getBlocks(from?, to?): Promise<[]> {
    return this.#askWorker('blocks', { from, to })
  }

  getBlock(index) {
    return this.#askWorker('block', index)
  }

  async addLoadedBlock(block) {
    if (block.decoded) block = { ...block.decoded, hahs: await block.hash() }
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

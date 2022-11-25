import { contractFactory, nativeToken, validators, nameService } from './../../addresses/src/addresses.js'
import { formatBytes } from './../../utils/src/utils'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import EasyWorker from '@vandeurenglenn/easy-worker'

// import State from './state'

export default class Machine {
  #contracts = {}
  #nonces = {}
  lastBlock = {index: 0, hash: '0x0', previousHash: '0x0'}

  constructor(blocks) {
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
      case 'contractError': {
        console.warn(`removing contract ${await data.hash}`);
        await contractStore.delete(await data.hash)  
      break
      }

      case 'executionError': {
        // console.warn(`error executing transaction ${data.message}`);
        pubsub.publish(data.id, {error: data.message})
      break
      }

      case 'debug': {
        for (const message of data.messages) debug(message)
      break
      }
      case 'machine-ready': {
        this.lastBlock = data.lastBlock
        pubsub.publish('machine.ready', true)
      break
      }
      case 'response': {
        pubsub.publish(data.id, data.value)
      break
      }
    }
    
  }

  async #init(blocks) {
    return new Promise(async (resolve) => {
      pubsub.subscribe('machine.ready', ()  => {
        resolve(this)
      })

      this.worker = await new EasyWorker(join(__dirname, './workers/machine-worker.js'), {serialization: 'advanced', type:'module'})
      this.worker.onmessage(this.#onmessage.bind(this))

      // const blocks = await blockStore.values()
      const contracts = await Promise.all([
        contractStore.get(contractFactory),
        contractStore.get(nativeToken),
        contractStore.get(validators),
        contractStore.get(nameService)
      ])
      
      const message = {
        type: 'init',
        input: {
          contracts,
          blocks,
          peerid: peernet.peerId
        }
      }
      this.worker.postMessage(message)
    })
    
  }

  async #runContract(contractMessage) {
    const parameters = contractMessage.decoded.constructorParameters
    try {

      const function_ = new Function(contractMessage.decoded.contract)
      const Contract = function_()

      globalThis.msg = this.#createMessage(contractMessage.decoded.creator)
      // globalThis.msg = {sender: contractMessage.decoded.creator}
      this.#contracts[await contractMessage.hash] = await new Contract(...parameters)
      debug(`loaded contract: ${await contractMessage.hash}`);
      debug(`size: ${formatBytes(contractMessage.encoded.length)}`);
    } catch (error) {
      console.log(error);
      console.warn(`removing contract ${await contractMessage.hash}`);
      await contractStore.delete(await contractMessage.hash, contractMessage.encoded)
    }
  }
  /**
   * @params {ContractMessage} - contractMessage
   */
  async addContract(contractMessage) {
    if (!await contractStore.has(contractMessage.hash)) {
      await contractStore.put(contractMessage.hash, contractMessage.encoded)
      await this.#runContract(contractMessage)
      return contractMessage.hash
    }
    throw new Error('duplicate contract')
  }

  async execute(contract, method, parameters) {
    return new Promise((resolve, reject) => {
      const id = randomBytes(20).toString('hex')
      const message = message => {
        if (message?.error) reject(message.error)
        else resolve(message)
      }
      pubsub.subscribe(id, message)
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

  addJob(contract, method, parameters, from, nonce) {
    if (!this.#nonces[from]) this.#nonces[from] = nonce
    if (nonce === this.#nonces[from] + 1) return this.#contracts[contract][method](...parameters)
    // return setTimeout(() => {
    //   return this.addJob(contract, method, params, from, nonce)
    // }, 50)
  }

  get(contract, method, parameters) {
    return new Promise((resolve, reject) => {
      const id = randomBytes(20).toString()
      const message = message => {
        resolve(message)
      }
      pubsub.subscribe(id, message)
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

  async delete(hash) {
    return contractStore.delete(hash)
  }

  /**
   * 
   * @returns Promise
   */
  async deleteAll() {
    let hashes = await contractStore.get()
    hashes = Object.keys(hashes).map(hash => this.delete(hash))
    return Promise.all(hashes)
  }
}

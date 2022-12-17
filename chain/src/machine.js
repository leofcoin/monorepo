import { contractFactory, nativeToken, validators, nameService } from '@leofcoin/addresses'
import randombytes from 'randombytes'
import { join, dirname } from 'node:path'
import EasyWorker from '@vandeurenglenn/easy-worker'
import { ContractMessage } from '@leofcoin/messages'
// import State from './state'
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
        console.warn(`removing contract ${await data.hash()}`);
        await contractStore.delete(await data.hash())  
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
      const machineReady = () => {
        pubsub.unsubscribe('machine.ready', machineReady)
        resolve(this)
      }
      pubsub.subscribe('machine.ready', machineReady)

      this.worker = await new EasyWorker('node_modules/@leofcoin/workers/src/machine-worker.js', {serialization: 'advanced', type:'module'})
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
    const hash = await contractMessage.hash()
    return new Promise((resolve, reject) => {
      const id = randombytes(20).toString('hex')
      const onmessage = message => {        
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
  async execute(contract, method, parameters) {
    try {
      if (contract === contractFactory && method === 'registerContract') {
        if (this.#contracts[parameters[0]]) throw new Error(`duplicate contract @${parameters[0]}`)
        let message;
        if (!await contractStore.has(parameters[0])) {
          message = await peernet.get(parameters[0], 'contract')
          message = await new ContractMessage(message)
          await contractStore.put(await message.hash(), message.encoded)
        }
        if (!message) {
          message = await contractStore.get(parameters[0])
          message = await new ContractMessage(message)
        }
        if (!this.#contracts[await message.hash()]) await this.#runContract(message)
      }
    } catch (error) {
      throw new Error(`contract deployment failed for ${parameters[0]}\n${error.message}`)
    }
    return new Promise((resolve, reject) => {
      const id = randombytes(20).toString('hex')
      const onmessage = message => {        
        pubsub.unsubscribe(id, onmessage)
        if (message?.error) reject(message.error)
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

  addJob(contract, method, parameters, from, nonce) {
    if (!this.#nonces[from]) this.#nonces[from] = nonce
    if (nonce === this.#nonces[from] + 1) return this.#contracts[contract][method](...parameters)
    // return setTimeout(() => {
    //   return this.addJob(contract, method, params, from, nonce)
    // }, 50)
  }

  get(contract, method, parameters) {
    return new Promise((resolve, reject) => {
      const id = randombytes(20).toString()
      const onmessage = message => {
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

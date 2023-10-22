import { contractFactory, nativeToken, validators, nameService } from '@leofcoin/addresses'
import { randombytes } from '@leofcoin/crypto'
import EasyWorker from '@vandeurenglenn/easy-worker'
import { ContractMessage } from '@leofcoin/messages'
import { ExecutionError, ContractDeploymentError } from '@leofcoin/errors';
// import State from './state'

export default class Machine {
  worker: EasyWorker;
  #contracts = {};
  #nonces = {};
  lastBlock = {index: 0, hash: '0x0', previousHash: '0x0'};

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
      case 'contractError': {
        console.warn(`removing contract ${await data.hash()}`);

        // @ts-ignore
        await contractStore.delete(await data.hash())  
        break
      }

      case 'initError': {
        console.error(`init error: ${data.message}`);       
        break
      }

      case 'executionError': {
        // console.warn(`error executing transaction ${data.message}`);
        pubsub.publish(data.id, {error: data.message})
      break
      }

      case 'debug': {
        for (const message of data.messages) globalThis.debug(message)
      break
      }
      case 'machine-ready': {
        this.lastBlock = data.lastBlock
        pubsub.publish('machine.ready', true)
      break
      }
      case 'response': {
        pubsub.publish(data.id, data.value || false)
      break
      }
    }
    
  }

  async #init(blocks): Promise<Machine> {
    return new Promise(async (resolve) => {
      const machineReady = () => {
        pubsub.unsubscribe('machine.ready', machineReady)
        resolve(this)
      }
      pubsub.subscribe('machine.ready', machineReady)

      let pre: string
      
      try {
        const importee = await import('url')
        const url = importee.default
        if (url) pre = url.fileURLToPath(new URL('.', import.meta.url));
      } catch {
        // browser env
        pre = './'
      }

      this.worker = await new EasyWorker(pre + '@leofcoin/workers/machine-worker.js', {serialization: 'advanced', type:'module'})
      this.worker.onmessage(this.#onmessage.bind(this))
      // const blocks = await blockStore.values()
      const contracts = await Promise.all([
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
  async execute(contract, method, parameters): Promise<any> {
    try {
      if (contract === contractFactory && method === 'registerContract') {
        if (await this.has(parameters[0])) throw new Error(`duplicate contract @${parameters[0]}`)
        let message;
        if (!await globalThis.contractStore.has(parameters[0])) {
          message = await peernet.get(parameters[0], 'contract')
          message = await new ContractMessage(message)
          await globalThis.contractStore.put(await message.hash(), message.encoded)
        }
        if (!message) {
          message = await globalThis.contractStore.get(parameters[0])
          message = await new ContractMessage(message)
        }
        if (!await this.has(await message.hash())) await this.#runContract(message)
      }
    } catch (error) {
      throw new ContractDeploymentError(`contract deployment failed for ${parameters[0]}\n${error.message}`)
    }
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const onmessage = message => {
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


  async has(address) {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const id = randombytes(20).toString('hex')
      const onmessage = message => {        
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

  async delete(hash) {
    return globalThis.contractStore.delete(hash)
  }

  /**
   * 
   * @returns Promise
   */
  async deleteAll() {
    let hashes = await globalThis.contractStore.keys()
    hashes = Object.keys(hashes).map(hash => this.delete(hash))
    return Promise.all(hashes)
  }
}

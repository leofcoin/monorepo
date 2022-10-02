import { BlockMessage, ContractMessage, TransactionMessage } from './../../messages/src/messages'
import { contractFactory, nativeToken, validators, nameService } from './../../addresses/src/addresses.js'
import { formatBytes } from './../../utils/src/utils'
import { randomBytes } from 'crypto'
import { fork } from 'child_process'
import { join } from 'path'
// import State from './state'

export default class Machine {
  #contracts = {}
  #nonces = {}
  constructor() {
    return this.#init()
  }

  #createMessage(sender = peernet.id) {
    return {
      sender,
      call: this.execute,
      staticCall: this.get.bind(this)
    }
  }

  async #onmessage(data) {
    switch (data.type) {
      case 'contractError':
        console.warn(`removing contract ${await data.hash}`);
        await contractStore.delete(await data.hash)  
      break

      case 'executionError':
        // console.warn(`error executing transaction ${data.message}`);
        pubsub.publish(data.id, {error: data.message})
      break

      case 'debug':
        data.messages.forEach(message => debug(message))
      break
      case 'machine-ready':
        pubsub.publish('machine.ready')
      break
      case 'response':
        pubsub.publish(data.id, data.value)
      break
    }
    
  }

  async #init() {
    return new Promise(async (resolve) => {
    //   this.worker = new Worker('./workers/machine-worker.js')
    // this.worker.onmessage = this.#onmessage.bind(this)

      pubsub.subscribe('machine.ready', ()  => {
        resolve(this)
      })
this.worker = fork(join(__dirname, './workers/machine-worker.js'), {serialization: 'advanced'})
this.worker.on('message', this.#onmessage.bind(this))
    const blocks = await blockStore.values()
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
    this.worker.send(message)
      // this.worker.postMessage(message)
    })
    // return
    
  }

  async #runContract(contractMessage) {
    const params = contractMessage.decoded.constructorParameters
    try {

      const func = new Function(contractMessage.decoded.contract)
      const Contract = func()

      globalThis.msg = this.#createMessage(contractMessage.decoded.creator)
      // globalThis.msg = {sender: contractMessage.decoded.creator}
      this.#contracts[await contractMessage.hash] = await new Contract(...params)
      debug(`loaded contract: ${await contractMessage.hash}`);
      debug(`size: ${formatBytes(contractMessage.encoded.length)}`);
    } catch (e) {
      console.log(e);
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

  async execute(contract, method, params) {
    return new Promise((resolve, reject) => {
      const id = randomBytes(20).toString('hex')
      const message = message => {
        if (message?.error) reject(message.error)
        else resolve(message)
      }
      pubsub.subscribe(id, message)
      this.worker.send({
        type: 'execute',
        id,
        input: {
          contract,
          method,
          params
        }
      })
    })
    
  }

  addJob(contract, method, params, from, nonce) {
    if (!this.#nonces[from]) this.#nonces[from] = nonce
    if (nonce === this.#nonces[from] + 1) return this.#contracts[contract][method](...params)
    // return setTimeout(() => {
    //   return this.addJob(contract, method, params, from, nonce)
    // }, 50)
  }

  get(contract, method, params) {
    return new Promise((resolve, reject) => {
      const id = randomBytes(20).toString()
      const message = message => {
        resolve(message)
      }
      pubsub.subscribe(id, message)
      this.worker.send({
        type: 'get',
        id,
        input: {
          contract,
          method,
          params
        }
      })
    })
  }

  async delete(hash) {
    return contractStore.delete(hash)
  }

  async deleteAll() {
    let hashes = await contractStore.get()
    hashes = Object.keys(hashes).map(hash => this.delete(hash))
    return Promise.all(hashes)
  }
}

import vm from 'vm'
import ContractMessage from './messages/contract'
import TransactionMessage from './messages/transaction'
import lib from './lib'
import { info, subinfo } from './utils/utils'
export default class Machine {
  #contracts = {}

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

  async #init() {
    try {
      let contracts = [
        contractStore.get(lib.contractFactory),
        contractStore.get(lib.nativeToken),
        contractStore.get(lib.validators),
        contractStore.get(lib.nameService)
      ]

      contracts = await Promise.all(contracts)
      for (const contract of contracts) {
        const message = new ContractMessage(contract)
        await this.#runContract(message)
      }
    } catch (e) {
console.log(e);
    } finally {

    }
    // const transactions = await transactionStore.get()
    // console.log({transactions});
    // for (const key of Object.keys(transactions)) {
    //   const message = new TransactionMessage(transactions[key])
    //   console.log({message});
    //   const {from, to, method, params} = message.decoded
    //   globalThis.msg = this.#createMessage(from)
    //
    //   console.log({from, to, method, params});
    //   await this.execute(to, method, params)
    // }
    return this
  }

  async #runContract(contractMessage) {
    const params = contractMessage.decoded.constructorParameters
    try {

      const func = new Function(contractMessage.decoded.contract.toString())
      const Contract = func()

      globalThis.msg = this.#createMessage(contractMessage.decoded.creator)
      // globalThis.msg = {sender: contractMessage.decoded.creator}
      this.#contracts[contractMessage.hash] = new Contract(...params)
      info(`loaded contract: ${contractMessage.hash}`);
      subinfo(`size: ${Math.round((contractMessage.encoded.length / 1024) * 100) / 100} kb`);
    } catch (e) {
      console.log(e);
      console.warn(`removing contract ${contractMessage.hash}`);
      await contractStore.delete(contractMessage.hash, contractMessage.encoded)
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

  execute(contract, method, params) {
    return this.#contracts[contract][method](...params)
  }

  get(contract, method, params) {
    let result
    if (params?.length > 0) {
      result = this.#contracts[contract][method](params)
    } else {
      result = this.#contracts[contract][method]
    }
    return result
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

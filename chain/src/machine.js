import vm from 'vm'
import ContractMessage from './messages/contract'

export default class Machine {
  #contracts = {}

  constructor() {
    return this.#init()
  }

  async #init() {
    const contracts = await contractStore.get()
    for (const key of Object.keys(contracts)) {
      const contractMessage = new ContractMessage(contracts[key])
      await this.#runContract(contractMessage)
    }
    return this
  }

  async #runContract(contractMessage) {
    const params = contractMessage.decoded.constructorParameters
    const func = new Function(contractMessage.decoded.contract.toString())
    const Contract = func()
    globalThis.msg = {sender: contractMessage.decoded.creator}
    this.#contracts[contractMessage.hash] = new Contract(...params)
  }

  /**
   * @params {ContractMessage} - contractMessage
   */
  async addContract(contractMessage) {
    if (!await contractStore.has(contractMessage.hash)) {

      await contractStore.put(contractMessage.hash, contractMessage.encoded)
      await this.#runContract(contractMessage)
      console.log(contractMessage.hash);
      return contractMessage.hash
    }
    throw new Error('duplicate contract')
  }

  execute(contract, method, params) {
    return this.#contracts[contract][method](...params)
  }

  get(contract, property) {
    return this.#contracts[contract][property]
  }
}

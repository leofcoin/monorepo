export default class Factory {
  /**
   * string
   */
  #name = 'ArtOnlineContractFactory'
  /**
   * uint
   */
  #totalContracts = 0
  /**
   * Array => string
   */
  #contracts = []

  constructor(state) {
    if (state) {
      this.#contracts = state.contracts
      this.#totalContracts = state.totalContracts
    }
  }

  get state() {
    return {
      totalContracts: this.#totalContracts,
      contracts: this.#contracts
    }
  }

  get name() {
    return this.#name
  }

  get contracts() {
    return [...this.#contracts]
  }

  get totalContracts() {
    return this.#totalContracts
  }

  isvalid(hash, creator, contract, constructorParameters = []) {
    const message = new ContractMessage({
      creator,
      contract,
      constructorParameters
    })
    return Boolean(message.hash === hash)
  }

  async deployContract(contractHash, creator, contract, constructorParameters = []) {
    if (contract.creator !== msg.sender) throw new Error('only a contract creator can deploy a contract')
    if (await contractStore.has(hash)) throw new Error('duplicate contract')
    if (!this.isValid(contractHash, creator, contract, constructorParameters)) throw new Error('invalid contract')

    await contractStore.put(hash, encoded)
    this.#totalContracts += 1
    this.#contracts.push(hash)
  }
}

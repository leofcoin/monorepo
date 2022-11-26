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

  /** 
   * Object => address => Array[addresses]
   */
  #implementations = {}

  constructor(state) {
    if (state) {
      this.#contracts = state.contracts
      this.#totalContracts = state.totalContracts
      this.#implementations = state.implementations
    }
  }

  get state() {
    return {
      totalContracts: this.#totalContracts,
      contracts: this.#contracts,
      implementations: this.#implementations
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
  
  get implementations() {
    return {...this.#implementations}
  }

  /**
   * 
   * @param {Address} address contract address to register
   */
  async registerContract(address) {
    let isAllowed = false
    isAllowed = await msg.staticCall(address, 'hasRole', [msg.sender, 'IMPLEMENTATION_MANAGER'])
    if (!isAllowed) throw new Error('only the implementation manager can update') 
    if (this.#implementations[address]) throw new Error('already registered')

    this.#totalContracts += 1
    this.#implementations[address] = []
    this.#implementations[address].push(address)
    this.#contracts.push(address)
  }

  /**
   * updates the current implementation to a new address
   * 
   * @param {Address} address the current contract address
   * @param {Address} newAddress the new contract address
   */
  async updateImplementation(address, newAddress) {
    let isAllowed = false
    isAllowed = await msg.staticCall(address, 'hasRole', [msg.sender, 'IMPLEMENTATION_MANAGER'])
    if (!isAllowed) throw new Error('only the implementation manager can update')
    if (!this.#implementations[address]) throw new Error(`register ${address} before updating to ${newAddress}`)

    this.#implementations[address].push(newAddress)
  }

  /**
   * 
   * @param {Address} address the original contract address
   * @returns {Address} all implementations of the original contract
   */
   getImplementations(address) {
    return this.#implementations[address]
  }

  /**
   * 
   * @param {Address} address the original contract address
   * @param {Number} index the index of the implmentation item or undefined (returns the latest implementation when undefined)
   * @returns {Address} the latest/selected implementation of the original contract
   */
  getImplementation(address, index) {
    index = index || this.#implementations[address].length - 1
    return this.#implementations[address][index]
  }
}

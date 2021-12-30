export default class ContractFactory {
  constructor(validator) {
    this.validator = new Validator(validator)
  }

  async deploy(contract) {
    let address
    try {
      address = await create(hasher.hash(contract, 'contract'))
    } catch (e) {
      throw new Error('undeployable contract')
    }
    return this._deploy(address, contract)
  }

  async _deploy(address, contract) {
    this._contracts.set(address, contract)
  }

  async call(address, method, params) {
    const contract = this._contracts.get(address)
    contract[method](...params)
  }
}

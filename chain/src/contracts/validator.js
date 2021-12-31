import hasher from './crypto/hasher'
import {create} from './crypto/address'

export default class Validator {
  constructor(address) {
    this._init(address)
  }

  async _init(address) {
    const valid = await this.isValid(address, this)
    if (!valid) throw new Error('Invalid validator')
    return this
  }

  async isValid(address, contract) {
    contract = await create(hasher.hash(contract, 'contract'))
    return address === contract
  }
}

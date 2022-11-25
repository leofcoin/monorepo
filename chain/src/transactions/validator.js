import hasher from './crypto/hasher'
import {create} from './crypto/transaction'

export default class Validator {
  constructor(address) {
    this._init(address)
  }

  async _init(address) {
    const valid = await this.isValid(address, this)
    if (!valid) throw new Error('Invalid validator')
    return this
  }

  async isValid(hash, transaction) {
    return this.validateTransaction(hash, transaction)
  }

  async validateTransaction(hash, transaction) {
    delete transaction.hash
    transaction = await create(hasher.hash(transaction))
    if (transaction !== hash) throw new Error('invalid hash')
    // for (const input of transaction) {
    //   input
    // }
    return true

  }
}

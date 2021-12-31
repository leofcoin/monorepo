import Validator from './validator'

class Executer {
  constructor(address, validatorAddress) {
    this._init(address, validatorAddress)
  }

  async _init(address, validatorAddress) {
    const validator = await new Validator(validatorAddress)
    const valid = await validator.isValid(address, this)
    if (!valid) throw new Error('Invalid Executer')
    return this
  }

  /**
   * @param {String} method
   * @param {Address} caller
   * @param {Address} sender
   */
  shouldExecute(method, caller, sender) {
    await isType('string', method)
    await isType('address', caller)
    await isType('address', sender)
    // is it a plain or a bird?
    // check if the method call is private or public
    // every private function (aka not accessable from outside the contract)
    // should start with an underscore
    if (method.startsWith('_') && caller !== sender) return true
    return false
  }
}

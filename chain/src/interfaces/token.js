export default class Token {
  constructor(name, symbol, decimals = 18) {
    if (!name) throw new Error(`name undefined`)
    if (!symbol) throw new Error(`symbol undefined`)
    this._name = name
    this._symbol = symbol
    this._holders = 0
    this._balances = {}
    this._approved = {}
  }

  get name() {
    return this._name
  }

  get symbol() {
    return this._symbol
  }

  get holders() {
    return this._holders
  }

  get balances() {
    return this._balances
  }

  _beforeTransfer(from, to, amount) {
    if (this._balances[from] < amount) throw new Error('Balance to low')
  }

  _updateHolders(address, previousBalance) {
    if (this._balances[address] === 0) this._holders -= 1
    if (this._balances[address] > 0 && previousBalance === 0) this._holders += 1
  }

  _increaseBalance(address, amount) {
    const previousBalance = this._balances[address]
    this._balances[address] += amount
    this._updateHolders(address, previousBalance)
  }

  _decreaseBalance(address, amount) {
    const previousBalance = this._balances[address]
    this._balances[address] -= amount
    this._updateHolders(address, previousBalance)
  }

  balance(address) {
    return this._balances[address]
  }

  setApproval(owner, operator, amount) {
    if (!this._approved[owner]) this._approved[owner] = {}
    this._approved[owner][operator] = amount
  }


  approved(owner, operator, amount) {
    return this._approved[owner][operator] === amount
  }

  transfer(from, to, amount) {
    amount = this._beforeTransfer(from, to, amount)
    this._decreaseBalance(from, amount)
    this._increaseBalance(to, amount)
  }


}

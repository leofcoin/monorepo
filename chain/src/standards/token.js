export default class Token {
  /**
   * string
   */
  #name
  /**
   * String
   */
  #symbol
  /**
   * uint
   */
  #holders = 0
  /**
   * Object => Object => uint
   */
  #balances = {}
  /**
   * Object => Object => uint
   */
  #approvals = {}

  #decimals = 18

  #totalSupply = BigNumber.from(0)
  /**
   * Object => Array
   */
  #roles = {
    'OWNER': [],
    'MINT': [],
    'BURN': []
  }
    // this.#privateField2 = 1
  constructor(name, symbol, decimals = 18) {
    if (!name) throw new Error(`name undefined`)
    if (!symbol) throw new Error(`symbol undefined`)
    this.#name = name
    this.#symbol = symbol
    this.#decimals = decimals
    this.#grantRole(msg.sender, 'OWNER')
  }

  get name() {
    return this.#name
  }

  get symbol() {
    return this.#symbol
  }

  get holders() {
    return this.#holders
  }

  get balances() {
    return {...this.#balances}
  }

  get roles() {
    return {...this.#roles}
  }

  hasRole(address, role) {
    return this.#roles[role] ? this.#roles[role].indexOf(address) !== -1 : false
  }

  #grantRole(address, role) {
    if (this.hasRole(address, role)) throw new Error(`${role} role already granted for ${address}`)

    this.#roles[role].push(address)
  }

  grantRole(address, role) {
    if (!this.hasRole(address, 'OWNER')) throw new Error('Not allowed')

    this.#grantRole(address, role)
  }

  mint(to, amount) {
    if (!this.hasRole(msg.sender, 'MINT')) throw new Error('not allowed')

    this.#totalSupply = this.#totalSupply.add(amount)
    this.#increaseBalance(to, amount)
  }

  burn(to, amount) {
    if (!this.hasRole(msg.sender, 'BURN')) throw new Error('not allowed')

    this.#totalSupply = this.#totalSupply.sub(amount)
    this.#decreaseBalance(to, amount)
  }

  #beforeTransfer(from, to, amount) {
    if (!this.#balances[from] || this.#balances[from] < amount) throw new Error('amount exceeds balance')
  }

  #updateHolders(address, previousBalance) {
    if (this.#balances[address] === 0) this.#holders -= 1
    if (this.#balances[address] > 0 && previousBalance === 0) this.#holders += 1
  }

  #increaseBalance(address, amount) {
    const previousBalance = this.#balances[address]
    if (!this.#balances[address]) this.#balances[address] = BigNumber.from(0)

    this.#balances[address] = this.#balances[address].add(amount)
    this.#updateHolders(address, previousBalance)
  }

  #decreaseBalance(address, amount) {
    const previousBalance = this.#balances[address]
    this.#balances[address] = this.#balances[address].sub(amount)
    this.#updateHolders(address, previousBalance)
  }

  balanceOf(address) {
    return this.#balances[address]
  }

  setApproval(operator, amount) {
    const owner = globalThis.msg.sender
    if (!this.#approvals[owner]) this.#approvals[owner] = {}
    this.#approvals[owner][operator] = amount
  }

  approved(owner, operator, amount) {
    return this.#approvals[owner][operator] === amount
  }

  transfer(from, to, amount) {
    amount = BigNumber.from(amount)
    this.#beforeTransfer(from, to, amount)
    this.#decreaseBalance(from, amount)
    this.#increaseBalance(to, amount)
  }


}

import { restoreApprovals, restoreBalances } from './helpers.js'
import Roles, { RolesState } from './roles.js'

export interface TokenState extends RolesState {
  holders: bigint
  balances: { [address: address]: bigint }
  approvals: { [owner: address]: { [operator: address]: bigint } }
  totalSupply: bigint
}

export default class Token extends Roles {
  /**
   * string
   */
  #name: string
  /**
   * String
   */
  #symbol: string
  /**
   * uint
   */
  #holders: bigint = 0n
  /**
   * Object => Object => uint
   */
  #balances = {}
  /**
   * Object => Object => uint
   */
  #approvals: { [owner: string]: { [operator: string]: bigint } } = {}

  #decimals = 18

  #totalSupply: bigint = 0n
  // #blacklist: { [address: string]: boolean } = {}

  constructor(
    name: string,
    symbol: string,
    decimals: number = 18,
    state?: TokenState
  ) {
    if (!name) throw new Error(`name undefined`)
    if (!symbol) throw new Error(`symbol undefined`)

    super(state)

    if (state) {
      this.#balances = restoreBalances(state.balances)
      this.#approvals = restoreApprovals(state.approvals)
      this.#holders = BigInt(state.holders)
      this.#totalSupply = BigInt(state.totalSupply)
    } else {
      this.#name = name
      this.#symbol = symbol
      this.#decimals = decimals
    }
  }

  // enables snapshotting
  // needs dev attention so nothing breaks after snapshot happens
  // iow everything that is not static needs to be included in the stateObject
  /**
   * @return {Object} {holders, balances, ...}
   */
  get state(): {} {
    return {
      ...super.state,
      holders: this.holders,
      balances: this.balances,
      approvals: { ...this.#approvals },
      totalSupply: this.totalSupply
    }
  }

  get totalSupply(): bigint {
    return this.#totalSupply
  }

  get name(): string {
    return this.#name
  }

  get symbol(): string {
    return this.#symbol
  }

  get holders(): {} {
    return this.#holders
  }

  get balances(): {} {
    return { ...this.#balances }
  }

  get approvals() {
    return this.#approvals
  }

  get decimals() {
    return this.#decimals
  }

  mint(to: address, amount: bigint) {
    if (!this.hasRole(msg.sender, 'MINT')) throw new Error('not allowed')

    this.#totalSupply = this.#totalSupply + amount
    this.#increaseBalance(to, amount)
  }

  burn(from: address, amount: bigint) {
    if (!this.hasRole(msg.sender, 'BURN')) throw new Error('not allowed')

    this.#totalSupply = this.#totalSupply - amount

    this.#beforeTransfer(from, from, amount)
    this.#decreaseBalance(from, amount)
  }

  #beforeTransfer(from: address, to: address, amount: bigint) {
    if (!from) throw new Error('address undefined')
    // if (this.#blacklist[from]) throw new Error('address blacklisted')
    // if (this.#blacklist[to]) throw new Error('address blacklisted')
    if (amount < 0n) throw new Error('amount must be positive')
    if (!this.#balances[from] || this.#balances[from] < amount)
      throw new Error('amount exceeds balance')
  }

  #updateHolders(address: address, previousBalance: bigint) {
    if (this.#balances[address] === 0n) this.#holders -= 1n
    else if (this.#balances[address] !== 0n && previousBalance === 0n)
      this.#holders += 1n
  }

  #increaseBalance(address: address, amount: bigint) {
    if (!this.#balances[address]) this.#balances[address] = 0n

    const previousBalance = this.#balances[address]
    this.#balances[address] = this.#balances[address] + amount
    this.#updateHolders(address, previousBalance)
  }

  #decreaseBalance(address: address, amount: bigint) {
    const previousBalance = this.#balances[address]
    this.#balances[address] = this.#balances[address] - amount
    this.#updateHolders(address, previousBalance)
  }

  balance() {
    return this.#balances[msg.sender]
  }

  balanceOf(address: address): bigint {
    return this.#balances[address]
  }

  setApproval(operator: address, amount: bigint) {
    const owner = msg.sender
    if (!this.#approvals[owner]) this.#approvals[owner] = {}
    this.#approvals[owner][operator] = BigInt(amount)
  }

  approved(owner: address, operator: address, amount: bigint): boolean {
    return this.#approvals[owner][operator] === amount
  }

  transfer(from: address, to: address, amount: bigint) {
    // TODO: is bigint?
    amount = BigInt(amount)
    this.#beforeTransfer(from, to, amount)
    this.#decreaseBalance(from, amount)
    this.#increaseBalance(to, amount)
  }
}

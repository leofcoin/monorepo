import { lottery } from 'lucky-numbers'
import Roles from '@leofcoin/standards/roles.js'
import type { RolesState } from '@leofcoin/standards/interfaces.js'

export declare interface ValidatorsState extends RolesState {
  balances: { [address: string]: bigint }
  minimumBalance: bigint
  currency: address
  validators: address[]
  currentValidator: address
}

export default class Validators extends Roles {
  /**
   * string
   */
  #name = 'LeofcoinValidators'
  /**
   * Object => string(address) => Object
   */
  #validators: address[] = []

  #currentValidator: address

  #currency: address

  #minimumBalance: bigint = BigInt(50_000)

  #balances: { [address: address]: bigint } = {}

  get state() {
    return {
      ...super.state,
      balances: this.#balances,
      minimumBalance: this.#minimumBalance,
      currency: this.#currency,
      validators: this.#validators,
      currentValidator: this.#currentValidator
    }
  }

  constructor(tokenAddress: address, state: ValidatorsState) {
    super(state)
    if (state) {
      this.#minimumBalance = BigInt(state.minimumBalance)
      this.#currency = state.currency
      this.#validators = state.validators
      this.#balances = state.balances
      this.#currentValidator = state.currentValidator
    } else {
      this.#currency = tokenAddress
      this.#validators.push(msg.sender)
      this.#currentValidator = msg.sender
    }
  }

  get currentValidator() {
    return this.#currentValidator
  }

  get name() {
    return this.#name
  }

  get currency() {
    return this.#currency
  }

  get validators() {
    return this.#validators
  }

  get totalValidators() {
    return this.#validators.length
  }

  get minimumBalance() {
    return this.#minimumBalance
  }

  changeCurrency(currency) {
    if (!this.hasRole(msg.sender, 'OWNER')) throw new Error('not an owner')
    this.#currency = currency
  }

  has(validator) {
    return this.#validators.includes(validator)
  }

  #isAllowed(address) {
    if (msg.sender !== address && !this.hasRole(msg.sender, 'OWNER'))
      throw new Error('sender is not the validator or owner')
    return true
  }

  async addValidator(validator: address) {
    this.#isAllowed(validator)
    if (this.has(validator)) throw new Error('validator already exists')

    const balance = await msg.staticCall(this.currency, 'balanceOf', [validator])

    if (this.minimumBalance > balance)
      throw new Error(`balance to low! got: ${balance} need: ${this.#minimumBalance}`)

    await msg.call(this.currency, 'transfer', [validator, msg.contract, this.#minimumBalance])

    this.#balances[validator] = this.#minimumBalance
    this.#validators.push(validator)
  }

  async removeValidator(validator) {
    this.#isAllowed(validator)
    if (!this.has(validator)) throw new Error('validator not found')
    await msg.call(this.currency, 'transfer', [msg.contract, validator, this.#minimumBalance])
    delete this.#balances[validator]
    this.#validators.splice(this.#validators.indexOf(validator), 1)
  }

  shuffleValidator() {
    // todo introduce voting mechanism
    // select amount of peers to vote & pass when 2/3 select the same peer
    // this.vote
    // todo only ids should be accessable
    const _peers = state.peers
    const peers = _peers
      // only validators make a chance
      .filter((peer) => this.#validators.includes(peer[0]))
      // add up the bytes
      .map((peer) => {
        peer[1].totalBytes = peer[1].bw.up + peer[1].bw.down
        return peer
      })
      .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
      // only return 128 best participating max
      .splice(0, _peers.length > 128 ? 128 : _peers.length)

    const luckyNumber = lottery(1, peers.length - 1)

    let nextValidator = peers[luckyNumber[0]][0]
    // redraw when the validator is the same
    // but keep the net alive when only one validator is found
    if (this.#currentValidator === nextValidator && peers.length !== 1) {
      const luckyNumber = lottery(1, peers.length - 1)
      nextValidator = peers[luckyNumber[0]][0]
    }
    this.#currentValidator = nextValidator
  }
}

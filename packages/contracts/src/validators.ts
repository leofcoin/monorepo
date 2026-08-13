import Roles from '@leofcoin/standards/roles.js'
import type { RolesState } from '@leofcoin/standards/interfaces.js'

export declare interface ValidatorsState extends RolesState {
  balances: { [address: string]: bigint }
  minimumBalance: bigint
  currency: address
  validators: address[]
  currentValidator: address
  validatorHistory: { [height: number]: address[] }
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

  /** Track validator set changes at each block height (for protocol safety) */
  #validatorHistory: { [height: number]: address[] } = {}

  get state() {
    return {
      ...super.state,
      balances: this.#balances,
      minimumBalance: this.#minimumBalance,
      currency: this.#currency,
      validators: this.#validators,
      currentValidator: this.#currentValidator,
      validatorHistory: this.#validatorHistory
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
      this.#validatorHistory = state.validatorHistory || {}
    } else {
      this.#currency = tokenAddress
      this.#validators.push(msg.sender)
      this.#currentValidator = msg.sender
      this.#validatorHistory[0] = [msg.sender]
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

  /** Query validators at a specific block height (enables height-scoped validator snapshots) */
  validatorsByHeight(height: number) {
    // If we have history for this height, return it
    if (this.#validatorHistory[height]) {
      return this.#validatorHistory[height]
    }

    // Otherwise return current validators
    // (In future, could query historical state from block headers)
    return this.#validators
  }

  /** Record validator set change at a specific block height */
  recordValidatorSnapshot(height: number) {
    // Create a snapshot of current validators at this height
    this.#validatorHistory[height] = [...this.#validators]
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
    const validators = [...new Set(this.#validators)].sort()
    if (validators.length === 0) return
    const seed = `${state.lastBlock?.hash ?? '0x0'}:${state.lastBlock?.index ?? -1}`
    let value = 0n
    for (const character of seed) value = (value * 31n + BigInt(character.charCodeAt(0))) % 4_294_967_291n
    let index = Number(value % BigInt(validators.length))
    if (validators.length > 1 && validators[index] === this.#currentValidator) index = (index + 1) % validators.length
    this.#currentValidator = validators[index]
  }
}

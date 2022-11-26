import Roles from './../standards/roles'

export default class Validators extends Roles {
  /**
   * string
   */
  #name = 'ArtOnlineValidators'
  /**
   * uint
   */
  #totalValidators = 0

  #activeValidators = 0
  /**
   * Object => string(address) => Object
   */
  #validators = {}

  #currency

  #minimumBalance

  get state() {
    return {
      ...super.state,
      minimumBalance: this.#minimumBalance,
      currency: this.#currency,
      totalValidators: this.#totalValidators,
      activeValidators: this.#activeValidators,
      validators: this.#validators
    }
  }

  constructor(tokenAddress, state) {
    super(state?.roles)
    if (state) {
      this.#minimumBalance = state.minimumBalance
      this.#currency = state.currency

      this.#totalValidators = state.totalValidators
      this.#activeValidators = state.activeValidators
      this.#validators = state.validators
    } else {
      this.#minimumBalance = 50_000
      this.#currency = tokenAddress

      this.#totalValidators += 1
      this.#activeValidators += 1
      this.#validators[msg.sender] = {
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        active: true
      }
    }

  }

  get name() {
    return this.#name
  }

  get currency() {
    return this.#currency
  }

  get validators() {
    return {...this.#validators}
  }

  get totalValidators() {
    return this.#totalValidators
  }

  get minimumBalance() {
    return this.#minimumBalance
  }

  changeCurrency(currency) {
    if (!this.hasRole(msg.sender, 'OWNER')) throw new Error('not an owner')
    this.#currency = currency
  }

  has(validator) {
    return Boolean(this.#validators[validator] !== undefined)
  }

  #isAllowed(address) {
    if (msg.sender !== address && !this.hasRole(msg.sender, 'OWNER')) throw new Error('sender is not the validator or owner')
    return true
  }

  async addValidator(validator) {
    this.#isAllowed(validator)
    if (this.has(validator)) throw new Error('already a validator')
    
    const balance = await msg.staticCall(this.currency, 'balanceOf', [validator])

    if (balance < this.minimumBalance) throw new Error(`balance to low! got: ${balance} need: ${this.#minimumBalance}`)

    this.#totalValidators += 1
    this.#activeValidators += 1
    this.#validators[validator] = {
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      active: true
    }
  }

  removeValidator(validator) {
    this.#isAllowed(validator)
    if (!this.has(validator)) throw new Error('validator not found')
    
    this.#totalValidators -= 1
    if (this.#validators[validator].active) this.#activeValidators -= 1
    delete this.#validators[validator]
  }

  async updateValidator(validator, active) {
    this.#isAllowed(validator)
    if (!this.has(validator)) throw new Error('validator not found')
    const balance = await msg.staticCall(this.currency, 'balanceOf', [validator])
    if (balance < this.minimumBalance && active) throw new Error(`balance to low! got: ${balance} need: ${this.#minimumBalance}`)
    if (this.#validators[validator].active === active) throw new Error(`already ${active ? 'activated' : 'deactivated'}`)
    if (active) this.#activeValidators += 1
    else this.#activeValidators -= 1
    /** minimum balance always needs to be met */
    this.#validators[validator].active = active
  }
}

export default class Validators {
  /**
   * string
   */
  #name = 'ArtOnlineValidators'
  /**
   * uint
   */
  #totalValidators = 0
  /**
   * Object => string(address) => Object
   */
  #validators = {}

  #owner

  #currency

  #minimumBalance

  get state() {
    return {
      owner: this.#owner,
      minimumBalance: this.#minimumBalance,
      currency: this.#currency,
      totalValidators: this.#totalValidators,
      validators: this.#validators
    }
  }

  constructor(tokenAddress, state) {
    if (state) {
      this.#owner = state.owner
      this.#minimumBalance = state.minimumBalance
      this.#currency = state.currency

      this.#totalValidators = state.totalValidators
      this.#validators = state.validators
    } else {
      this.#owner = msg.sender
      this.#minimumBalance = 50000
      this.#currency = tokenAddress

      this.#totalValidators += 1
      this.#validators[msg.sender] = {
        firstSeen: new Date().getTime(),
        active: true
      }
    }

  }

  get name() {
    return this.#name
  }

  get owner() {
    return this.#owner
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

  changeOwner(owner) {
    if (msg.sender !== this.#owner) throw new Error('not an owner')
  }

  changeCurrency(currency) {
    if (msg.sender !== this.#owner) throw new Error('not an owner')
    this.#currency = currency
  }

  has(validator) {
    return Boolean(this.#validators[validator] !== undefined)
  }

  async addValidator(validator) {
    if (this.has(validator)) throw new Error('already a validator')
    const balance = await msg.staticCall(this.currency, 'balanceOf', [msg.sender])

    if (balance < this.minimumBalance) throw new Error(`balance to low! got: ${balance} need: ${this.#minimumBalance}`)

    this.#totalValidators += 1
    this.#validators[validator] = {
      firstSeen: new Date().getTime(),
      active: true
    }
  }

  removeValidator(validator) {
    if (!this.has(validator)) throw new Error('validator not found')

    this.#totalValidators -= 1
    delete this.#validators[validator]
  }

  async updateValidator(validator, active) {
    if (!this.has(validator)) throw new Error('validator not found')
    const balance = await msg.staticCall(this.currency, 'balanceOf', [msg.sender])
    if (balance < this.minimumBalance && this.#validators[validator].active) this.#validators[validator].active = false

    if (balance < this.minimumBalance) throw new Error(`balance to low! got: ${balance} need: ${this.#minimumBalance}`)

    this.#validators[validator].active = active
  }
}

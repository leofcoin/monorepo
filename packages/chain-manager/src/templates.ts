export const FAUCET_SOURCE = `export default class TestnetFaucet {
  #owner
  #token
  #amount
  #cooldown
  #budget
  #spent = 0n
  #claims = {}

  constructor(token, amount, cooldownMs, budget, state) {
    this.#owner = state ? state.owner : msg.sender
    this.#token = state ? state.token : token
    this.#amount = BigInt(state ? state.amount : amount)
    this.#cooldown = Number(state ? state.cooldown : cooldownMs)
    this.#budget = BigInt(state ? state.budget : budget)
    if (state) {
      this.#spent = BigInt(state.spent)
      this.#claims = { ...state.claims }
    }
    if (this.#amount <= 0n || this.#budget < this.#amount ||
        !Number.isSafeInteger(this.#cooldown) || this.#cooldown < 60000)
      throw new Error('Invalid faucet limits')
  }
  get creator() { return this.#owner === msg.sender }
  get owner() { return this.#owner }
  get token() { return this.#token }
  get remainingBudget() { return this.#budget - this.#spent }
  get state() {
    return { owner: this.#owner, token: this.#token, amount: this.#amount.toString(),
      cooldown: this.#cooldown, budget: this.#budget.toString(), spent: this.#spent.toString(),
      claims: { ...this.#claims } }
  }
  async claim() {
    const recipient = msg.sender
    const now = Date.now()
    const previous = this.#claims[recipient]
    if (previous !== undefined && now - Number(previous) < this.#cooldown)
      throw new Error('Claim cooldown has not elapsed')
    if (this.#spent + this.#amount > this.#budget) throw new Error('Faucet lifetime budget reached')
    this.#claims[recipient] = now
    this.#spent += this.#amount
    return msg.call(this.#token, 'transfer', [recipient, this.#amount.toString()])
  }
  async withdraw(recipient, amount) {
    if (msg.sender !== this.#owner) throw new Error('Only the faucet owner may withdraw')
    amount = BigInt(amount)
    if (amount <= 0n) throw new Error('Amount must be positive')
    return msg.call(this.#token, 'transfer', [recipient, amount.toString()])
  }
}`

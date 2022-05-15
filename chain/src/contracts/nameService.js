export default class NameService {
  /**
   * string
   */
  #name = 'ArtOnlineNameService'
  /**
   * string
   */
  #owner
  /**
   * number
   */
  #price = 0
  /**
   * Object => string
   */
  #registry = {}

  /**
   * => string
   */
  #currency

  get name() {
    return this.#name
  }

  get registry() {
    return {...this.#registry}
  }

  get state() {

  }

  // TODO: control with contract
  constructor(factoryAddress, currency, validatorAddress, price, state) {
    if (state) {
      this.#owner = state.owner
      this.#registry = state.registry
      this.#currency = state.currency
      this.#price = state.price
    } else {
      this.#owner = msg.sender
      this.#price = price
      this.#registry['ArtOnlineContractFactory'] = {
        owner: msg.sender,
        address: factoryAddress
      }

      this.#registry['ArtOnlineToken'] = {
        owner: msg.sender,
        address: currency
      }

      this.#registry['ArtOnlineValidators'] = {
        owner: msg.sender,
        address: validatorAddress
      }

      this.#currency = currency
    }
  }

  changeOwner(owner) {
    if (msg.sender !== this.#owner) throw new Error('no owner')
    this.#owner = owner
  }

  changePrice(price) {
    if (msg.sender !== this.#owner) throw new Error('no owner')
    this.#price = price
  }

  changeCurrency(currency) {
    if (msg.sender !== this.#owner) throw new Error('no owner')
    this.#currency = currency
  }

  async purchaseName(name, address) {
    const balance = await msg.call(this.#currency, 'balanceOf', [msg.sender])
    if (balance < this.#price) throw new Error('price exceeds balance')
    try {
      await msg.call(this.#currency, 'transfer', [msg.sender, this.#owner, this.#price])
    } catch (e) {
      throw e
    }

    this.#registry[name] = {
      owner: msg.sender,
      address
    }
  }

  lookup(name) {
    return this.#registry[name]
  }

  transferOwnership(name, to) {
    if (msg.sender !== this.#registry.owner) throw new Error('not a owner')
    this.#registry[name].owner = to
  }

  changeAddress(name, address) {
    if (msg.sender !== this.#registry.owner) throw new Error('not a owner')
    this.#registry[name].address = address
  }
}

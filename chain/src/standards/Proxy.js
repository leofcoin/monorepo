import Roles from './roles.js'

export default class Proxy extends Roles {
  #proxyManager
  #implementation

  constructor(proxyManager, state) {
    super(state?.roles)
    if (state) {
      this.#proxyManager = state.proxyManager
    } else {
      this.#proxyManager = proxyManager
    }
  }

  get state() {
    return {
      ...super.state,
      proxyManager: this.#proxyManager,
      implementation: this.#implementation
    }
  }

  async setImplementation(address) {
    if (msg.sender !== this.#proxyManager) throw new Error(`not allowed, expected proxy manager`)

    const state = await stateStore.get(this.#implementation)
    await stateStore.put(address, state)
    stateStore.delete(this.#implementation)
    this.#implementation = address
  }

  async changeProxyManager(address) {
    if (msg.sender !== this.#proxyManager) throw new Error(`not allowed, expected proxy manager`)
    this.#proxyManager = address
  }

  fallback(method, params) {
    if (msg.sender === this.proxyManager) return this[method](...params)
    return msg.internalCall(msg.sender, this.#implementation, method, params)
  }
}

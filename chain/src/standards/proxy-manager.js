import Roles from './roles.js'

export default class ProxyManager extends Roles {
  #name
  #proxies = {}
  #manager


  constructor(name, state) {
    super(state?.roles)
    this.#name = name

    if (state) {
      this.#proxies = state.proxies
      this.#manager = state.manager
    } else {
      this.#manager = msg.sender
    }
  }

  /**
   *
   */
  async #upgradeProxy(proxy, address) {
    await msg.internalCall(this.#manager, proxy, 'setImplementation', [address])
    this.#proxies[proxy] = address
  }

  /**
   *
   */
  upgradeProxy(proxy, address) {
    if (!this.hasRole(msg.sender, 'MANAGER')) throw new Error('Not allowed, expected MANAGER')
    this.#upgradeProxy(proxy, address)
  }

  async #changeManager(address) {
    this.#revokeRole(this.#manager, 'MANAGER')
    this.#grantRole(address, 'MANAGER')
    for (const proxy of Object.keys(this.#proxies)) {
      await msg.internalCall(this.#manager, proxy, 'changeProxyManager', [address])
    }
    this.#manager = address
  }

  changeManager(address) {
    if (!this.hasRole(msg.sender, 'OWNER')) throw new Error('Not allowed, expected OWNER')
    return this.#changeManager(address)
  }

  get state() {
    return {
      ...super.state,
      proxies: this.proxies,
      manager: this.manager
    }
  }

  get manager() {
    return this.#manager
  }

  get proxies() {
    return { ...this.#proxies }
  }
}

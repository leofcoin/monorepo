import Proxy from './../../standards/Proxy.js'

export default class NameServiceProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineNameServiceProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

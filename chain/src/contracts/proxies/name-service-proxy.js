import Proxy from '../../standards/proxy.js'

export default class NameServiceProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineNameServiceProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

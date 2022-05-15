import Proxy from './../../standards/Proxy.js'

export default class FactoryProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineContractFactoryProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

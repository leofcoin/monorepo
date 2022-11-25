import Proxy from '../../standards/proxy.js'

export default class FactoryProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineContractFactoryProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

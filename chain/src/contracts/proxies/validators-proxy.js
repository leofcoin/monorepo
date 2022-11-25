import Proxy from '../../standards/proxy.js'

export default class ValidatorsProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineValidatorsProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

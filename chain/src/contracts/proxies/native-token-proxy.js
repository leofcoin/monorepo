import Proxy from '../../standards/proxy.js'

export default class NativeTokenProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineNativeTokenProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

import Proxy from './../../standards/Proxy.js'

export default class NativeTokenProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineNativeTokenProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

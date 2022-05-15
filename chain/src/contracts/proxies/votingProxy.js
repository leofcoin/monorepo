import Proxy from './../../standards/Proxy.js'

export default class VotingProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineVotingProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

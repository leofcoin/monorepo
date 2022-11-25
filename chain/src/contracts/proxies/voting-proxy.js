import Proxy from '../../standards/proxy.js'

export default class VotingProxy extends Proxy {
  /**
   * string
   */
  #name = 'ArtOnlineVotingProxy'

  constructor(proxyManager, state) {
    super(proxyManager, state)
  }
}

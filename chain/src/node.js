// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '../../lib/src/node-config';
import networks from '../../networks/networks';

export default class Node {
  constructor() {
    return this._init()
  }

  async _init(config = {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'v1.0.0',
    stars: networks.leofcoin.peach.stars
  }) {
    globalThis.Peernet ? await new globalThis.Peernet(config) : await new Peernet(config)
    await nodeConfig(config)

    return this
    // this.config = await config()
  }

}

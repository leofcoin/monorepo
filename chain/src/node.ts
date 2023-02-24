// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '@leofcoin/lib/node-config';
import networks from '@leofcoin/networks';

export default class Node {
  constructor(config, password: string) {
    return this._init(config, password)
  }

  async _init(config = {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    stars: networks.leofcoin.peach.stars
  }, password: string): Promise<this> {
    globalThis.Peernet ? await new globalThis.Peernet(config, password) : await new Peernet(config, password)
    await nodeConfig(config)

    return this
    // this.config = await config()
  }

}

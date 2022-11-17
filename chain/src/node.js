// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '../../lib/src/node-config';

export default class Node {
  constructor() {
    return this._init()
  }

  async _init(config = {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: '1.0.0'
  }) {
    globalThis.Peernet ? await new globalThis.Peernet(config) : await new Peernet(config)
    await nodeConfig()

    return this
    // this.config = await config()
  }

}

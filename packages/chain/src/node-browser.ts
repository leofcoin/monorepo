// import config from './config/config'
import Peernet from '@leofcoin/peernet/browser'
import nodeConfig from '@leofcoin/lib/node-config';
import networks from '@leofcoin/networks';

export default class Node {
  #node;

  constructor(config, password: string) {
    return this._init(config, password)
  }

  async _init(config = {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    stars: networks.leofcoin.peach.stars
  }, password: string): Promise<this> {
    this.#node = globalThis.Peernet ? await new globalThis.Peernet(config, password) : await new Peernet(config, password)
    await nodeConfig(config)

    globalThis.pubsub.subscribe('chain:ready', async () => {
      if (!this.#node.autoStart) {
        await this.#node.start()
        pubsub.publish('node:ready', true)
      }
    })
    return this
    // this.config = await config()
  }

}

// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '@leofcoin/lib/node-config';
import networks from '@leofcoin/networks';

export default class Node {
  #node;

  constructor(config, password) {
    return this._init(config, password)
  }

  async _init(config = {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    stars: networks.leofcoin.peach.stars,
    autoStart: false
  }, password) {
    this.#node = globalThis.Peernet ? await new globalThis.Peernet(config, password) : await new Peernet(config, password)
    await nodeConfig(config)
    
    globalThis.pubsub.subscribe('chain:ready', () => {
      // when autostart is false the node will only be started after the chain is ready (this is here so we can just use node for communication)
      if (!this.#node.autoStart) this.#node.start()
    })
    return this
    // this.config = await config()
  }

}

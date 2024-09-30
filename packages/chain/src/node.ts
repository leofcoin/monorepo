// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '@leofcoin/lib/node-config'
import networks from '@leofcoin/networks'
import { DEFAULT_NODE_OPTIONS } from './constants.js'

export default class Node {
  #node

  constructor(config, password) {
    // @ts-ignore
    return this._init(config, password)
  }

  async _init(
    config = {
      network: 'leofcoin:peach',
      networkName: 'leofcoin:peach',
      networkVersion: 'peach',
      version: '0.1.0',
      stars: networks.leofcoin.peach.stars,
      autoStart: false
    },
    password
  ) {
    config = { ...DEFAULT_NODE_OPTIONS, ...config }
    this.#node = globalThis.Peernet
      ? await new globalThis.Peernet(config, password)
      : await new Peernet(config, password)
    await nodeConfig(config)

    globalThis.pubsub.subscribe('chain:ready', async () => {
      // when autostart is false the node will only be started after the chain is ready (this is here so we can just use node for communication)
      if (!this.#node.autoStart) {
        await this.#node.start()
        pubsub.publish('node:ready', true)
      }
    })
    return this
    // this.config = await config()
  }
}

// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '@leofcoin/lib/node-config'
import networks from '@leofcoin/networks'
import { DEFAULT_NODE_OPTIONS, type NodeOptions } from './constants.js'

export default class Node {
  #node
  ready: Promise<this>

  constructor(config: NodeOptions = {}, password?: string) {
    this.ready = this._init(config, password)
  }

  async _init(
    config: NodeOptions = { autoStart: false },
    password?: string
  ) {
    config = { ...DEFAULT_NODE_OPTIONS, ...config }
    if (config.storeNamespace && !config.root) {
      const [network, networkVersion] = config.network.split(':')
      config.root = `.${network}/${networkVersion || config.networkVersion}/${config.storeNamespace}`
    }
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

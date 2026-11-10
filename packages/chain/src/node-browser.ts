import { installBinaryPeerProtocol } from './binary-peer-protocol.js'
// import config from './config/config'
import Peernet from '@leofcoin/peernet/browser'
import Identity from '@leofcoin/peernet/browser/identity'
import nodeConfig from '@leofcoin/lib/node-config'
import networks from '@leofcoin/networks'
import { type NodeOptions } from './constants.js'
import { guardPeerMessages, guardProviderDiscovery } from './connection-monitor.js'
import { browserRoutingId } from './routing-identity-browser.js'
import { chainDiscoveryOptions, chainPeernetOptions, assertDiscoveryNamespace } from './star-namespace.js'

export default class Node {
  #node

  constructor(config, password: string) {
    return this._init(config, password)
  }

  async _init(config: NodeOptions = {}, password: string): Promise<this> {
    const SDK = globalThis.Peernet ?? Peernet
    if ((SDK as any).discoveryProtocolVersion !== 3) throw new Error('Install the app-ID Peernet release before starting this node')
    config = await chainDiscoveryOptions(config)
    const autoStart = config.autoStart
    config = { ...config, autoStart: false, routingId: await browserRoutingId(config) }
    const peerOptions = {...chainPeernetOptions(config),identity:new Identity(config.network)}
    this.#node = globalThis.Peernet
      ? await new globalThis.Peernet(peerOptions, password)
      : await new Peernet(peerOptions, password)
    Object.defineProperty(this.#node,'ledgerNetwork',{value:config.network,enumerable:true})
    assertDiscoveryNamespace(this.#node,config)
    installBinaryPeerProtocol(this.#node)
    guardPeerMessages(this.#node)
    guardProviderDiscovery(this.#node)
    await nodeConfig(config)
    if (autoStart) {
      this.#node.autoStart = true
      await this.#node.start()
    }

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

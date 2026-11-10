import { installBinaryPeerProtocol } from './binary-peer-protocol.js'
// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import Identity from '@leofcoin/peernet/identity'
import nodeConfig from '@leofcoin/lib/node-config'
import networks from '@leofcoin/networks'
import { type NodeOptions } from './constants.js'
import { guardPeerMessages, guardProviderDiscovery } from './connection-monitor.js'
import { nodeRoutingId } from './routing-identity-node.js'
import { chainDiscoveryOptions, chainPeernetOptions, assertDiscoveryNamespace } from './star-namespace.js'

export default class Node {
  #node
  ready: Promise<this>

  constructor(config: NodeOptions = {}, password?: string) {
    this.ready = this._init(config, password)
  }

  async _init(config: NodeOptions = { autoStart: false }, password?: string) {
    const SDK = globalThis.Peernet ?? Peernet
    if ((SDK as any).discoveryProtocolVersion !== 3) throw new Error('Install the app-ID Peernet release before starting this node')
    config = await chainDiscoveryOptions(config)
    const autoStart = config.autoStart
    config = { ...config, autoStart: false }
    // Load the chain's supported native version before swarm starts discovery.
    // Swarm otherwise resolves its own older optional dependency.
    const backend = (config as any).transport?.webrtc?.backend ||
      process.env.NETPEER_SWARM_WRTC_BACKEND || 'vandeurenglenn'
    if (backend === 'vandeurenglenn' && !globalThis.RTCPeerConnection && !globalThis.wrtc) {
      globalThis.wrtc = await import('@vandeurenglenn/wrtc')
      globalThis.__swarmWrtcImpl = backend
    }
    if (config.storeNamespace && !config.root) {
      const [network, networkVersion] = config.network.split(':')
      config.root = `.${network}/${networkVersion || 'mainnet'}/${config.storeNamespace}`
    }
    config = { ...config, routingId: await nodeRoutingId(config) }
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

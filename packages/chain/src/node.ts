// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import nodeConfig from '@leofcoin/lib/node-config'
import networks from '@leofcoin/networks'
import { DEFAULT_NODE_OPTIONS, type NodeOptions } from './constants.js'
import { guardPeerMessages } from './connection-monitor.js'

export default class Node {
  #node
  ready: Promise<this>

  constructor(config: NodeOptions = {}, password?: string) {
    this.ready = this._init(config, password)
  }

  async _init(config: NodeOptions = { autoStart: false }, password?: string) {
    config = { ...DEFAULT_NODE_OPTIONS, ...config }
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
      config.root = `.${network}/${networkVersion || config.networkVersion}/${config.storeNamespace}`
    }
    this.#node = globalThis.Peernet
      ? await new globalThis.Peernet(config, password)
      : await new Peernet(config, password)
    guardPeerMessages(this.#node)
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

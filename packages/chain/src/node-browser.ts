import { installBinaryPeerProtocol } from './binary-peer-protocol.js'
// import config from './config/config'
import Peernet from '@leofcoin/peernet/browser'
import Identity from '@leofcoin/peernet/browser/identity'
import Storage from '@leofcoin/storage'
import nodeConfig from '@leofcoin/lib/node-config'
import networks from '@leofcoin/networks'
import { type NodeOptions } from './constants.js'
import { guardPeerMessages, guardProviderDiscovery } from './connection-monitor.js'
import { browserRoutingId } from './routing-identity-browser.js'
import { chainDiscoveryOptions, chainPeernetOptions, assertDiscoveryNamespace } from './star-namespace.js'
import { startRecoveryTransport } from './recovery-transport.js'
import { reserveNode } from './pq-runtime.js'

declare global {
  var LeofcoinStorage: typeof Storage
}

class Node {
  #node?: Peernet

  async _init(options: NodeOptions = {}, password?: string): Promise<this> {
    const SDK = globalThis.Peernet ?? Peernet
    if (SDK.discoveryProtocolVersion !== 3) throw new Error('Install the app-ID Peernet release before starting this node')
    let config = await chainDiscoveryOptions(options)
    reserveNode(config)
    const autoStart = config.autoStart
    config = { ...config, autoStart: false, routingId: await browserRoutingId(config) }
    const peerOptions = {...chainPeernetOptions(config),identity:config.identity ?? new Identity(config.network)}
    globalThis.LeofcoinStorage = Storage
    this.#node = globalThis.Peernet
      ? await new globalThis.Peernet(peerOptions, password)
      : await new Peernet(peerOptions, password)
    Object.defineProperty(this.#node,'ledgerNetwork',{value:config.network,enumerable:true})
    if (config.genesis) Object.defineProperty(this.#node, 'pqGenesis', { value: config.genesis })
    assertDiscoveryNamespace(this.#node,config)
    installBinaryPeerProtocol(this.#node)
    guardPeerMessages(this.#node)
    guardProviderDiscovery(this.#node)
    await nodeConfig(config)
    if (autoStart) {
      this.#node.autoStart = true
      await startRecoveryTransport(this.#node)
    }

    globalThis.pubsub.subscribe('chain:ready', () => {
      pubsub.publish('node:ready', true)
    })
    return this
    // this.config = await config()
  }
}

// A construct trap preserves the existing promise-returning browser API.
const AsyncNode = new Proxy(Node, {
  construct(target, args, newTarget) {
    const node: Node = Reflect.construct(target, [], newTarget)
    return node._init(args[0], args[1])
  }
})

const BrowserNode: new (config?: NodeOptions, password?: string) => Promise<Node> =
  AsyncNode as typeof AsyncNode & (new (config?: NodeOptions, password?: string) => Promise<Node>)

export default BrowserNode

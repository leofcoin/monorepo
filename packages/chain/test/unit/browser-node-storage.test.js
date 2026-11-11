import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import Peernet from '@leofcoin/peernet/browser'
import { methods } from '../helpers/canonical-state-harness.js'

test('browser node selects workspace storage before Peernet creates stores', async t => {
  const keys = ['Peernet', 'LeofcoinStorage', 'peernet', 'pubsub', 'contractStore', 'walletStore']
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })

  class Storage {
    constructor(name, root) { this.name = name; this.root = root }
    async init() { this.initialized = true }
  }
  class Peer {
    static discoveryProtocolVersion = 3
    stores = []
    hasDaemon = false
    constructor() { globalThis.peernet = this }
  }
  globalThis.Peernet = Peer
  globalThis.LeofcoinStorage = class LegacyStorage { async init() {} }
  globalThis.pubsub = { subscribe() {} }
  const wallet = {}
  globalThis.walletStore = wallet
  delete globalThis.contractStore

  const source = methods('../../src/node-browser.ts', 'Node', ['_init'])
  const script = ts.transpileModule(`class Node { #node; ${source} }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText
  const noop = () => {}
  const Node = new Function(
    'Storage', 'Peernet', 'Identity', 'chainDiscoveryOptions', 'browserRoutingId', 'chainPeernetOptions',
    'assertDiscoveryNamespace', 'installBinaryPeerProtocol', 'guardPeerMessages', 'guardProviderDiscovery',
    'nodeConfig', 'startRecoveryTransport', 'pubsub', `${script}; return Node`
  )(
    Storage, Peer, class Identity {}, async config => config, async () => 'routing-id', config => config,
    noop, noop, noop, noop, async () => {
      await Peernet.prototype.addStore.call(globalThis.peernet, 'contract', 'lfc', 'root', false)
    }, noop, globalThis.pubsub
  )

  await new Node()._init({ network: 'leofcoin:peach' }, 'fixture')
  assert.ok(globalThis.contractStore instanceof Storage)
  assert.equal(globalThis.contractStore.initialized, true)
  assert.deepEqual(globalThis.peernet.stores, ['contract'])
  assert.equal(globalThis.walletStore, wallet)
})

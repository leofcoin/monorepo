import { TAB_STORES } from './browser-node-tabs.js'

/** Public-data facade. No signer/password/identity export can cross this API. */
export function createBrowserNodeFollower(session, { global = globalThis, account = () => '' } = {}) {
  const listeners = new Map()
  const request = (kind, args) => session.request(kind, args)
  const chain = {
    get ready() { return session.ready.then(() => true) },
    get state() { return session.status?.state || { chain: 'loading', sync: 'errored' } },
    get loaded() { return session.available && chain.state.chain === 'loaded' },
    get version() { return session.status?.version },
    get nativeToken() { return session.status?.nativeToken },
    get lastBlock() { return Promise.resolve(session.status?.lastBlock) },
    async sendTransaction(signed) {
      if (signed?.from !== account()) throw new Error('Signed transaction does not belong to this tab’s selected account')
      const { hash } = await session.request('submit', [signed])
      const wait = session.request('wait', [hash], 5 * 60_000)
      wait.catch(() => {})
      return { hash, wait }
    },
    participate() { throw new Error('Enable validator participation from the main browser tab') },
    deployContract() { throw new Error('Deploy contracts from the main browser tab') }
  }
  for (const name of ['balanceOf', 'staticCall', 'lookup', 'getNonce', 'getBlock', 'getBlocks', 'getChainIdentity',
    'createTransaction', 'hasTransactionToHandle', 'createContractAddress'])
    chain[name] = (...args) => request('call', [name, ...args])
  for (const name of ['balances', 'accounts', 'contracts', 'totalContracts', 'nativeCalls', 'nativeMints', 'nativeBurns',
    'nativeTransfers', 'totalBurnAmount', 'totalMintAmount', 'totalTransferAmount', 'totalTransactions',
    'totalBlocks', 'totalSize', 'lastBlockHeight', 'blockHashMap', 'participating'])
    Object.defineProperty(chain, name, { get: () => request('read', [name]) })
  const peernet = {
    get id() { return session.status?.routingPeer },
    get peerId() { return session.status?.walletPeer },
    get selectedAccount() { return account() },
    get connections() { return Object.fromEntries((session.status?.peers || []).map(peer => [peer.id, peer])) },
    get peers() { return Object.entries(peernet.connections) },
    get identity() { return { id: peernet.peerId } },
    client: { get peerId() { return peernet.id } },
    async publish(topic, bytes) {
      if (!(bytes instanceof Uint8Array)) throw new TypeError('Cross-tab messages must be Uint8Array')
      return request('chat', [topic, bytes])
    },
    async subscribe(topic, handler) {
      // Only the app's signed/encrypted chat stream is multiplexed. No arbitrary
      // subscriptions, private daemon services or RPC topics.
      if (topic !== `leofcoin:chat:v1:${session.status?.network}` || typeof handler !== 'function') throw new Error('Unsupported shared-node subscription')
      if (!listeners.has(topic)) listeners.set(topic, new Set())
      listeners.get(topic).add(handler)
      return () => listeners.get(topic)?.delete(handler)
    },
    async get(hash, store) {
      if (!TAB_STORES.includes(store)) throw new Error('Unsupported shared-node store')
      return request('store', [store, 'get', hash])
    }
  }
  const stores = Object.fromEntries(TAB_STORES.map(name => [name, Object.fromEntries(
    ['get', 'has', 'keys', 'values', 'size', 'length'].map(method => [method, (...args) =>
      request('store', [name, method, ...(['keys', 'values'].includes(method) ? [Math.min(10000, args[0] > 0 ? args[0] : 10000)] : args)])])
  )]))
  session.onEvent((topic, bytes) => { for (const listener of listeners.get(topic) || []) listener(bytes) })
  return {
    chain, peernet, stores,
    install() {
      global.chain = chain; global.peernet = peernet
      for (const [name, store] of Object.entries(stores)) global[`${name}Store`] = store
    },
    uninstall() {
      if (global.chain === chain) delete global.chain
      if (global.peernet === peernet) delete global.peernet
      for (const [name, store] of Object.entries(stores)) if (global[`${name}Store`] === store) delete global[`${name}Store`]
    }
  }
}

import { encodeWire, decodeWire } from '@leofcoin/binary'

const LIMIT = 1_048_576
const topic = 'browser-node-tabs:v1'
const functions = new Set(['balanceOf', 'staticCall', 'lookup', 'getNonce', 'getBlock', 'getBlocks', 'getChainIdentity',
  'createTransaction', 'hasTransactionToHandle', 'createContractAddress'])
const properties = new Set(['balances', 'accounts', 'contracts', 'totalContracts', 'nativeCalls', 'nativeMints',
  'nativeBurns', 'nativeTransfers', 'totalBurnAmount', 'totalMintAmount', 'totalTransferAmount',
  'totalTransactions', 'totalBlocks', 'totalSize', 'lastBlockHeight', 'blockHashMap', 'participating'])
export const TAB_STORES = ['block', 'transaction', 'transactionPool', 'accounts', 'contract']
const storeReads = new Set(['get', 'has', 'keys', 'values', 'size', 'length'])
const randomId = () => crypto.randomUUID()

/** One real node per browser origin + network. Never elect on heartbeat timeout:
 * only the browser's exclusive lock may hand off the single state writer. */
export function createBrowserNodeTabs({ network, start, onFollower = () => {}, onUpdate = () => {},
  onError = () => {}, locks = globalThis.navigator?.locks, Channel = globalThis.BroadcastChannel,
  heartbeatMs = 2000, staleMs = 12000, requestTimeoutMs = 30000 } = {}) {
  if (!network || typeof start !== 'function' || !locks?.request || !Channel)
    throw new Error('Shared browser nodes require Web Locks and BroadcastChannel')
  const channel = new Channel(`leofcoin:node-tabs:v1:${network}`)
  const tab = randomId(), abort = new AbortController(), pending = new Map(), completions = new Map(), activeRequests = new Set(), waiting = new Map()
  let runtime, role = 'follower', leader = '', sequence = 0, latest = 0, lastSeen = 0, current, stopped = false, progress
  let release, readyResolve, readyReject, publishing = false, reportedStale = false
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  ready.catch(() => {})
  const send = message => { if (!stopped) channel.postMessage(encodeWire(topic, { ...message, sender: tab, network }, { maxBytes: LIMIT })) }
  const failRequests = message => {
    for (const item of pending.values()) {
      clearTimeout(item.timer)
      item.reject(new Error(message + (['submit', 'wait'].includes(item.operation)
        ? '. Transaction outcome may be unknown; check canonical history before retrying.' : '')))
    }
    pending.clear()
  }
  const unavailable = message => {
    current = current ? { ...current, state: { chain: 'loading', sync: 'errored' }, peers: [] } : undefined
    failRequests(message)
    if (current) onUpdate(current, role)
    onError(new Error(message))
  }
  const snapshot = async () => {
    const tip = await runtime.chain.lastBlock
    return {
    network, account: runtime.peernet.selectedAccount, walletPeer: runtime.peernet.peerId, routingPeer: runtime.peernet.id,
    version: runtime.chain.version, nativeToken: runtime.chain.nativeToken,
    state: { ...runtime.chain.state }, syncProgress: progress,
    lastBlock: { index: tip?.index, hash: tip?.hash, previousHash: tip?.previousHash },
    peers: Object.entries(runtime.peernet.connections || {}).filter(([, peer]) => peer?.connected)
      .map(([id, peer]) => ({ id, version: peer.version, connected: true })).slice(0, 100)
    }
  }
  const publish = async target => {
    if (!runtime || publishing || stopped) return
    publishing = true
    try {
      current = await snapshot()
      send({ type: 'status', target, sequence: ++sequence, snapshot: current })
      onUpdate(current, role)
    } catch (error) { onError(error) }
    finally { publishing = false }
  }
  const execute = async (operation, args) => {
    if (!Array.isArray(args) || args.length > 8) throw new Error('Invalid shared-node arguments')
    if (operation === 'call' && functions.has(args[0])) {
      if (args[0] === 'getBlocks' && (!Number.isSafeInteger(args[1]) || !Number.isSafeInteger(args[2]) ||
        args[1] < 0 || args[2] < args[1] || args[2] - args[1] > 256)) throw new Error('Invalid shared-node block range')
      return runtime.chain[args[0]](...args.slice(1))
    }
    if (operation === 'read' && properties.has(args[0])) {
      const value = await runtime.chain[args[0]]
      return value?.[Symbol.iterator] && !(value instanceof Uint8Array) && !Array.isArray(value) && typeof value !== 'string'
        ? [...value] : value
    }
    if (operation === 'store' && TAB_STORES.includes(args[0]) && storeReads.has(args[1])) {
      if (['keys', 'values'].includes(args[1]) && (!Number.isInteger(args[2]) || args[2] < 1 || args[2] > 10000))
        throw new Error('A bounded storage read is required')
      return runtime.stores[args[0]][args[1]](...args.slice(2))
    }
    if (operation === 'submit') {
      const transaction = args[0]
      if (!transaction || typeof transaction !== 'object' || !transaction.signature)
        throw new Error('Only already-signed transactions can be forwarded to the main tab')
      if (completions.size >= 256) throw new Error('Too many pending shared-tab transactions')
      const receipt = await runtime.chain.sendTransaction(transaction)
      if (!receipt?.hash || !receipt.wait?.then) throw new Error('No canonical transaction confirmation handle')
      const wait = Promise.resolve(receipt.wait)
      wait.catch(() => {})
      clearTimeout(completions.get(receipt.hash)?.timer)
      const entry = { wait, timer: setTimeout(() => completions.delete(receipt.hash), 10 * 60_000) }
      completions.set(receipt.hash, entry)
      return { hash: receipt.hash }
    }
    if (operation === 'wait') {
      const receipt = completions.get(args[0])
      if (!receipt) throw new Error('Confirmation handle unavailable; check canonical transaction history before retrying')
      let timer
      try {
        await Promise.race([receipt.wait, new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Confirmation timed out; outcome may be unknown. Check canonical history before retrying.')), 5 * 60_000)
          waiting.set(timer, reject)
        })])
        return true
      } finally { clearTimeout(timer); waiting.delete(timer) }
    }
    if (operation === 'chat' && args[0] === `leofcoin:chat:v1:${network}` && args[1] instanceof Uint8Array && args[1].byteLength <= 32000)
      return (await runtime.peernet.publish(args[0], args[1])) ?? true
    // No signing, account selection, private stores, arbitrary methods or
    // validator participation through cross-tab RPC.
    throw new Error('This action is not available from a following tab; use the main tab')
  }
  channel.onmessage = async event => {
    if (stopped || !(event.data instanceof Uint8Array) || event.data.byteLength > LIMIT) return
    let message
    try { message = decodeWire(topic, event.data, { maxBytes: LIMIT }) } catch { return }
    if (!message || message.network !== network || typeof message.sender !== 'string' || message.sender === tab ||
      (message.target && message.target !== tab)) return
    if (message.type === 'hello' && role === 'leader') { void publish(message.sender); return }
    if (message.type === 'status' && role === 'follower') {
      const value = message.snapshot
      if (!Number.isSafeInteger(message.sequence) || !value || value.network !== network || !Array.isArray(value.peers) || value.peers.length > 100 ||
        !value.state || typeof value.routingPeer !== 'string') return
      if (leader !== message.sender) { failRequests('Main tab changed; check pending transactions before retrying'); latest = 0 }
      if (message.sequence <= latest) return
      leader = message.sender; latest = message.sequence; lastSeen = Date.now(); current = value; reportedStale = false
      onFollower(api); onUpdate(current, role); readyResolve(api)
      return
    }
    if (message.type === 'request' && role === 'leader' && message.leader === tab && runtime && typeof message.id === 'string') {
      const key = `${message.sender}:${message.id}`
      if (activeRequests.has(key) || activeRequests.size >= 64) {
        send({ type: 'response', target: message.sender, id: message.id, error: 'Main-tab request is duplicate or capacity is reached' })
        return
      }
      activeRequests.add(key)
      try { send({ type: 'response', target: message.sender, id: message.id, value: await execute(message.operation, message.args) }) }
      catch (error) { send({ type: 'response', target: message.sender, id: message.id, error: error?.message || String(error) }) }
      finally { activeRequests.delete(key) }
      return
    }
    if (message.type === 'response' && message.sender === leader && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timer)
      message.error ? request.reject(new Error(message.error)) : request.resolve(message.value)
    }
    if (message.type === 'event' && message.sender === leader) onEvent?.(message.topic, message.value)
  }
  let onEvent
  const api = {
    ready,
    get role() { return role }, get status() { return current },
    get available() { return role === 'leader' ? Boolean(runtime) : Boolean(leader && Date.now() - lastSeen <= staleMs) },
    onEvent(handler) { onEvent = handler },
    async request(operation, args = [], timeout = requestTimeoutMs) {
      if (role === 'leader' && runtime) return execute(operation, args)
      if (!api.available) throw new Error('The main tab is unavailable; wait for an unlocked tab to take over')
      if (pending.size >= 256) throw new Error('Too many pending shared-tab requests')
      const id = randomId()
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Main-tab request timed out; it was not automatically retried')) }, timeout)
        pending.set(id, { resolve, reject, timer, operation })
        try { send({ type: 'request', target: leader, leader, id, operation, args }) }
        catch (error) { clearTimeout(timer); pending.delete(id); reject(error) }
      })
    },
    async close() {
      if (stopped) return
      // A live leader must stop its writers before releasing ownership. Real
      // browser runtimes instead hand off on document teardown, never pagehide.
      if (role === 'leader' && !runtime?.stop) throw new Error('Close the main tab to stop its browser node safely')
      if (role === 'leader') await runtime.stop()
      stopped = true; abort.abort(); clearInterval(timer); clearTimeout(startupTimer)
      for (const item of completions.values()) clearTimeout(item.timer)
      for (const [timer, reject] of waiting) { clearTimeout(timer); reject(new Error('Main tab closed before confirmation')) }
      waiting.clear()
      completions.clear(); failRequests('Browser node tab closed'); channel.close(); release?.()
    }
  }
  const timer = setInterval(() => {
    if (role === 'leader') void publish()
    else if (leader && Date.now() - lastSeen > staleMs && !reportedStale) {
      reportedStale = true
      unavailable('The main tab is not responding; waiting for browser ownership handoff')
    }
    else if (!leader) send({ type: 'hello' })
  }, heartbeatMs)
  const startupTimer = setTimeout(() => {
    readyReject(new Error('Waiting for the main browser tab timed out'))
    onError(new Error('Main tab did not become ready; reload this tab to try again'))
    if (role === 'follower') void api.close()
  }, 45000)
  ready.then(() => clearTimeout(startupTimer), () => clearTimeout(startupTimer))
  // All followers queue behind one lock. A paused background leader is never
  // forcibly replaced. Browser teardown releases its lock and terminates workers.
  locks.request(`leofcoin:node-owner:v1:${network}`, { mode: 'exclusive', signal: abort.signal }, async () => {
    if (stopped) return
    role = 'leader'; leader = tab; failRequests('This tab is taking over the browser node')
    onUpdate(undefined, role)
    try {
      runtime = await start()
      if (stopped) return
      runtime.pubsub?.subscribe('sync-progress', value => {
        if (value) progress = { startIndex: value.startIndex, localIndex: value.localIndex, targetIndex: value.targetIndex }
      })
      await runtime.peernet.subscribe?.(`leofcoin:chat:v1:${network}`, bytes => {
        if (bytes instanceof Uint8Array && bytes.byteLength <= 32000) {
          send({ type: 'event', topic: `leofcoin:chat:v1:${network}`, value: bytes })
          // Components created while following may retain their facade when
          // this tab becomes the main tab. Keep their subscriptions alive.
          onEvent?.(`leofcoin:chat:v1:${network}`, bytes)
        }
      })
      await publish()
      readyResolve(api)
      await new Promise(resolve => { release = resolve })
    } catch (error) {
      runtime = undefined; readyReject(error); unavailable(error?.message || String(error))
      // Startup may have partially opened stores/workers. Keep the writer
      // lease until document teardown; never start a second writer on top.
      await new Promise(resolve => { release = resolve })
    }
  }).catch(error => { if (!stopped) { readyReject(error); onError(error) } })
  send({ type: 'hello' })
  return api
}

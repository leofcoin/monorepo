import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserNodeTabs } from '../src/controllers/browser-node-tabs.js'
import { createBrowserNodeFollower } from '../src/controllers/browser-node-follower.js'
import { decodeWire } from '@leofcoin/binary'

async function until(check) {
  const end = Date.now() + 5000
  while (Date.now() < end) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 10)) }
  throw new Error('Condition did not become true')
}
function fixture() {
  let starts = 0, submitted = 0, confirmed, dropStatus = false, chatReceiver
  const completions = new Promise(resolve => { confirmed = resolve })
  const messages = []
  class ObservedChannel extends BroadcastChannel {
    postMessage(bytes) {
      assert(bytes instanceof Uint8Array)
      const message = decodeWire('browser-node-tabs:v1', bytes)
      messages.push(message)
      if (dropStatus && message.type === 'status') return
      return super.postMessage(bytes)
    }
  }
  const start = async () => {
    starts++
    return {
      chain: { version: '1.0.0', nativeToken: 'token', state: { chain: 'loaded', sync: 'synced' },
        lastBlock: { index: 12n, hash: 'canonical-tip' }, balances: { account: 100n },
        balanceOf: async () => 100n, staticCall: async () => [1n, 2n],
        createTransaction: async input => ({ ...input, nonce: 1, timestamp: 1 }),
        sendTransaction: async () => { submitted++; return { hash: 'signed-transaction', wait: completions } } },
      peernet: { selectedAccount: 'account', peerId: 'wallet-peer', id: 'account-routing-id',
        identity: { privateKey: 'NEVER-SHARE-THIS', password: 'NEVER-SHARE-PASSWORD' },
        connections: { remote: { connected: true, version: '1.0.0' } }, subscribe: async (topic, handler) => { chatReceiver = handler }, publish: async () => true },
      pubsub: { subscribe: (topic, handler) => handler({ startIndex: 1, localIndex: 10, targetIndex: 12, secret: 'NEVER-SHARE-PROGRESS-EXTRAS' }) },
      stores: { block: { get: async () => new Uint8Array([1, 2, 3]), keys: async () => ['block'] } },
      stop: async () => {}
    }
  }
  return { start, Channel: ObservedChannel, network: `leofcoin:test-${crypto.randomUUID()}`,
    heartbeatMs: 20, staleMs: 2000, requestTimeoutMs: 2000, messages,
    confirmed, emitChat: bytes => chatReceiver(bytes), set dropStatus(value) { dropStatus = value }, get starts() { return starts }, get submitted() { return submitted } }
}

test('one main tab owns the runtime; followers sync, read and forward only signed transactions with real finality', async t => {
  const f = fixture()
  const main = createBrowserNodeTabs(f)
  await main.ready
  const follow = createBrowserNodeTabs(f)
  t.after(async () => { await follow.close(); await main.close() })
  await follow.ready
  assert.equal(f.starts, 1)
  assert.equal(main.role, 'leader'); assert.equal(follow.role, 'follower')
  assert.equal(follow.status.routingPeer, main.status.routingPeer)
  assert.deepEqual(follow.status.syncProgress, { startIndex: 1, localIndex: 10, targetIndex: 12 })
  const global = {}, adapter = createBrowserNodeFollower(follow, { global, account: () => 'account' })
  adapter.install()
  assert.equal(global.peernet.id, 'account-routing-id')
  assert.equal(global.peernet.peerId, 'wallet-peer')
  assert.equal(global.peernet.selectedAccount, 'account')
  assert.equal(await global.chain.balanceOf('account'), 100n)
  assert.deepEqual(await global.blockStore.get('block'), new Uint8Array([1, 2, 3]))
  assert.deepEqual(await global.chain.balances, { account: 100n })
  await assert.rejects(follow.request('call', ['sign', 'hash']), /not available/)
  await assert.rejects(follow.request('store', ['wallet', 'get', 'identity']), /not available/)
  await assert.rejects(follow.request('store', ['block', 'clear']), /not available/)
  await assert.rejects(follow.request('submit', [{ from: 'account' }]), /already-signed/)
  await assert.rejects(global.chain.sendTransaction({ from: 'other', signature: 'signature' }), /selected account/)
  const receipt = await global.chain.sendTransaction({ from: 'account', signature: 'signed-locally' })
  let settled = false
  receipt.wait.then(() => { settled = true })
  assert.equal(f.submitted, 1)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(settled, false, 'admission is not canonical confirmation')
  f.confirmed(true)
  await receipt.wait
  assert.equal(settled, true)
  const serialized = JSON.stringify(f.messages, (_, value) => typeof value === 'bigint' ? String(value) : value)
  assert.equal(serialized.includes('NEVER-SHARE'), false)
  adapter.uninstall()
  assert.equal(global.chain, undefined)
})

test('followers take over only after the writer lock is released; pending writes are not retried', async t => {
  const f = fixture()
  const main = createBrowserNodeTabs(f); await main.ready
  const follow = createBrowserNodeTabs(f); await follow.ready
  t.after(async () => { await follow.close(); await main.close() })
  const adapter = createBrowserNodeFollower(follow)
  const received = []
  await adapter.peernet.subscribe(`leofcoin:chat:v1:${f.network}`, bytes => received.push(bytes))
  const { hash } = await follow.request('submit', [{ signature: 'signed-locally' }])
  const waiting = follow.request('wait', [hash])
  waiting.catch(() => {})
  await main.close()
  await until(() => follow.role === 'leader' && follow.available && f.starts === 2)
  await assert.rejects(waiting, /taking over|changed/)
  assert.equal(follow.status.routingPeer, 'account-routing-id')
  assert.equal(f.submitted, 1, 'uncertain transactions are never resubmitted during handoff')
  f.emitChat(new Uint8Array([7, 8]))
  assert.deepEqual(received, [new Uint8Array([7, 8])], 'existing facade subscriptions survive promotion to main tab')
})

test('a paused main tab becomes unavailable but never loses its writer lease on a timeout', async t => {
  const f = fixture()
  const main = createBrowserNodeTabs(f); await main.ready
  const errors = []
  const follow = createBrowserNodeTabs({ ...f, staleMs: 100, onError: error => errors.push(error.message) }); await follow.ready
  t.after(async () => { await follow.close(); await main.close() })
  f.dropStatus = true
  await until(() => !follow.available && follow.status?.state.sync === 'errored')
  assert.equal(f.starts, 1)
  assert.equal(follow.role, 'follower')
  await assert.rejects(follow.request('read', ['balances']), /unavailable/)
  assert.equal(errors.length, 1)
  f.dropStatus = false
  await until(() => follow.available && follow.status.state.sync === 'synced')
  assert.equal(f.starts, 1)
})

test('unsupported cross-tab primitives fail explicitly rather than starting an uncoordinated node', () => {
  assert.throws(() => createBrowserNodeTabs({ network: 'test', start: async () => {}, locks: null }), /Web Locks/)
})

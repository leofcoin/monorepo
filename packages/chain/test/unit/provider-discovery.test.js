import assert from 'node:assert/strict'
import test from 'node:test'
import { Codec, FormatInterface } from '@leofcoin/codec-format-interface'
import { guardProviderDiscovery } from '../../exports/connection-monitor.js'

class Request extends FormatInterface {
  constructor(value) {
    super(value, { hash: '', 'store?': '' }, { name: 'peernet-dht' })
  }
}
class Response extends FormatInterface {
  constructor(value) {
    super(value, { hash: '', has: false }, { name: 'peernet-dht-response' })
  }
}
class DataRequest extends FormatInterface {
  constructor(value) {
    super(value, { hash: '', 'store?': '' }, { name: 'peernet-data' })
  }
}
class DataResponse extends FormatInterface {
  constructor(value) {
    super(value, { hash: '', data: new Uint8Array() }, { name: 'peernet-data-response' })
  }
}

const setup = (connections) => {
  const providers = []
  const peernet = {
    id: 'local',
    connections,
    protos: {
      'peernet-dht': Request, 'peernet-dht-response': Response,
      'peernet-data': DataRequest, 'peernet-data-response': DataResponse
    },
    async handleData() { throw new Error('original handleData') },
    async sendMessage() {},
    async requestData() { throw new Error('original requestData') },
    async prepareMessage(request) { return { encoded: request.encoded } },
    dht: { addProvider(provider, hash) { providers.push({ ...provider, hash }) } }
  }
  guardProviderDiscovery(peernet)
  return { peernet, providers }
}
const peer = (request) => ({ connected: true, remoteAddress: 'address', request })
const response = (has, hash = 'wanted') => new Response({ hash, has }).encoded
const nextTurn = () => new Promise(resolve => setImmediate(resolve))
const installStore = (t, name, store) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { value: store, configurable: true, writable: true })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  })
}

test('a fast non-provider cannot hide a slower provider', async () => {
  let release
  const delayed = new Promise(resolve => { release = resolve })
  const { peernet, providers } = setup({
    empty: peer(async () => response(false)),
    provider: peer(() => delayed)
  })
  let settled = false
  const walk = peernet.walk('wanted').then(() => { settled = true })
  await nextTurn()
  assert.equal(settled, false)
  assert.deepEqual(providers, [])
  release(response(true))
  await walk
  assert.deepEqual(providers, [{ id: 'provider', address: 'address', hash: 'wanted' }])
})

test('discovery returns once a positive response arrives without waiting for all peers', async () => {
  let release
  const delayed = new Promise(resolve => { release = resolve })
  const { peernet, providers } = setup({
    provider: peer(async () => response(true)),
    slow: peer(() => delayed)
  })
  await peernet.walk('wanted')
  assert.equal(providers.length, 1)
  release(response(false))
  await nextTurn()
})

test('wrong-hash, malformed and rejected responses do not win over valid providers', async (t) => {
  const warnings = t.mock.method(console, 'warn', () => {})
  const { peernet, providers } = setup({
    wrong: peer(async () => response(true, 'other')),
    malformed: peer(async () => Uint8Array.of(255)),
    failed: peer(async () => { throw new Error('disconnected') }),
    valid: peer(async () => response(true))
  })
  await peernet.walk('wanted')
  assert.deepEqual(providers, [{ id: 'valid', address: 'address', hash: 'wanted' }])
  assert.ok(warnings.mock.callCount() >= 3)
})

test('all-negative discovery completes explicitly without adding providers', async (t) => {
  const warnings = t.mock.method(console, 'warn', () => {})
  const { peernet, providers } = setup({ empty: peer(async () => response(false)) })
  await peernet.walk('wanted')
  assert.deepEqual(providers, [])
  assert.match(warnings.mock.calls[0].arguments[0], /No connected provider/)
})

test('disconnected and self peers are not queried', async () => {
  const request = () => { throw new Error('must not query') }
  const { peernet } = setup({
    local: peer(request),
    disconnected: { ...peer(request), connected: false }
  })
  await peernet.walk('wanted')
  await assert.rejects(peernet.walk(''), /hash expected/)
})

test('a stalled peer is bounded by the existing request timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(console, 'warn', () => {})
  const { peernet, providers } = setup({ stalled: peer(() => new Promise(() => {})) })
  const walk = peernet.walk('wanted')
  await nextTurn()
  t.mock.timers.tick(30_000)
  await walk
  assert.deepEqual(providers, [])
})

test('chain data requests probe the exact store and do not let an empty peer hide a provider', async () => {
  const data = Uint8Array.of(1, 2, 3)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { peernet } = setup({
    pendingOnly: peer(async bytes => {
      const request = new Request(bytes).decoded
      assert.equal(request.store, 'transaction')
      return response(false)
    }),
    canonical: peer(async bytes => {
      const { Codec } = await import('@leofcoin/codec-format-interface')
      if (new Codec(bytes).name === 'peernet-dht') {
        assert.equal(new Request(bytes).decoded.store, 'transaction')
        await gate
        return response(true)
      }
      assert.equal(new DataRequest(bytes).decoded.store, 'transaction')
      return new DataResponse({ hash: 'wanted', data }).encoded
    })
  })
  const request = peernet.requestData('wanted', 'transaction')
  release()
  assert.deepEqual(await request, data)
})

test('chain data requests reject mismatched responses and leave unrelated stores unchanged', async () => {
  const { peernet } = setup({
    wrong: peer(async bytes => {
      const { Codec } = await import('@leofcoin/codec-format-interface')
      if (new Codec(bytes).name === 'peernet-dht') return response(true)
      return new DataResponse({ hash: 'other', data: Uint8Array.of(1) }).encoded
    })
  })
  await assert.rejects(peernet.requestData('wanted', 'transaction'), /Content unavailable/)
  await assert.rejects(peernet.requestData('wanted', 'data'), /original requestData/)
})

test('incoming chain data requests return local bytes with the original request id', async t => {
  const data = Uint8Array.of(1, 2, 3)
  installStore(t, 'blockStore', {
    private: false, async has(hash) { return hash === 'wanted' }, async get() { return data }
  })
  const { peernet } = setup({})
  const sent = t.mock.method(peernet, 'sendMessage', async () => {})
  const remote = peer(async () => { throw new Error('must not fetch') })
  await peernet.handleData(remote, 'request-id', new DataRequest({ hash: 'wanted', store: 'block' }))
  const [recipient, id, bytes] = sent.mock.calls[0].arguments
  assert.equal(recipient, remote)
  assert.equal(id, 'request-id')
  assert.deepEqual(new DataResponse(bytes).decoded, { hash: 'wanted', data })
})

test('missing, private and disappearing chain data never trigger network fetches', async t => {
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'error', () => {})
  installStore(t, 'blockStore', undefined)
  for (const store of [
    undefined,
    { private: true, async has() { throw new Error('must not inspect private store') } },
    { async has() { return false }, async get() { throw new Error('must not read absent key') } },
    { async has() { return true }, async get() { return undefined } },
    { async has() { return true }, async get() { throw new TypeError("Cannot read properties of undefined (reading 'length')") } }
  ]) {
    globalThis.blockStore = store
    const { peernet } = setup({})
    const fetches = t.mock.method(peernet, 'requestData', async () => { throw new Error('must not relay') })
    const sent = t.mock.method(peernet, 'sendMessage', async () => {})
    await peernet.handleData(peer(), 'request-id', new DataRequest({ hash: 'wanted', store: 'block' }))
    assert.equal(fetches.mock.callCount(), 0)
    assert.equal(sent.mock.callCount(), 1)
    assert.deepEqual(new DataResponse(sent.mock.calls[0].arguments[2]).decoded, {
      hash: 'wanted', data: new Uint8Array()
    })
  }
})

test('incoming chain data send failures are logged without rejecting the detached handler', async t => {
  const errors = t.mock.method(console, 'error', () => {})
  installStore(t, 'transactionPoolStore', {
    async has() { return true }, async get() { return Uint8Array.of(1) }
  })
  const { peernet } = setup({})
  t.mock.method(peernet, 'sendMessage', async () => { throw new Error('peer disconnected') })
  await assert.doesNotReject(peernet.handleData(peer(), 'id', new DataRequest({ hash: 'wanted', store: 'transactionPool' })))
  assert.match(errors.mock.calls[0].arguments[0], /chain data response failed/)
})

test('incoming unrelated data requests retain the original handler', async () => {
  const { peernet } = setup({})
  await assert.rejects(peernet.handleData(peer(), 'id', new DataRequest({ hash: 'wanted', store: 'data' })), /original handleData/)
})

test('a provider losing content after a positive probe does not hide a remaining provider', async t => {
  t.mock.method(console, 'warn', () => {})
  installStore(t, 'blockStore', {
    async has() { return false },
    async get() { throw new Error('must not read missing block') }
  })
  const { peernet: server } = setup({})
  const serverFetches = t.mock.method(server, 'requestData', async () => { throw new Error('must not relay') })
  const data = Uint8Array.of(7, 8, 9)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { peernet: client } = setup({
    stale: peer(async bytes => {
      if (new Codec(bytes).name === 'peernet-dht') return response(true)
      let reply
      server.sendMessage = async (_peer, id, encoded) => {
        assert.equal(id, 'data-request')
        reply = encoded
      }
      await server.handleData(peer(), 'data-request', new DataRequest(bytes))
      release()
      return reply
    }),
    available: peer(async bytes => {
      if (new Codec(bytes).name === 'peernet-dht') {
        await gate
        return response(true)
      }
      return new DataResponse({ hash: 'wanted', data }).encoded
    })
  })
  assert.deepEqual(await client.requestData('wanted', 'block'), data)
  assert.equal(serverFetches.mock.callCount(), 0)
})

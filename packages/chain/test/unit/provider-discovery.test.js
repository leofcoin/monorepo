import assert from 'node:assert/strict'
import test from 'node:test'
import { FormatInterface } from '@leofcoin/codec-format-interface'
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

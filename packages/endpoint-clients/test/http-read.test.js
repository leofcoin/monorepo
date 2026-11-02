import assert from 'node:assert/strict'
import test from 'node:test'
import HttpClient from '../exports/http.js'
import { encodeWire, decodeWire } from '@leofcoin/binary'

test('HTTP contract reads preserve parameter arrays and exact bigint results', async t => {
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  const queries = []
  globalThis.fetch = async (url, options) => {
    assert.equal(options.body instanceof Uint8Array, true)
    assert.equal(new URL(url).search, '')
    queries.push(decodeWire('rpc', options.body).params)
    return new Response(encodeWire('rpc', { value: 2n ** 100n }), { headers: { 'Content-Type': 'application/octet-stream' } })
  }
  const client = new HttpClient('https://fixture.invalid', 'peach')
  assert.deepEqual(await client.staticCall('contract', 'quote', ['receiver', 2n ** 80n]), { value: 2n ** 100n })
  await client.staticCall('contract', 'state')
  assert.deepEqual(queries, [['receiver', 2n ** 80n], []])
  await assert.rejects(client.staticCall('contract', 'state', 'not-an-array'), /must be an array/)
})

test('HTTP read errors are explicit rather than returned as successful contract values', async t => {
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  globalThis.fetch = async () => new Response(encodeWire('rpc', { error: 'Read-only call attempted to change contract state' }), { status: 422, headers: { 'Content-Type': 'application/octet-stream' } })
  await assert.rejects(new HttpClient('https://fixture.invalid', 'peach').staticCall('contract', 'increment'), /Read-only call/)
})

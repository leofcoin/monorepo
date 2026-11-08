import assert from 'node:assert/strict'
import test from 'node:test'
import http from '../exports/http.js'
import { encodeWire, decodeWire } from '@leofcoin/binary'
const read = async response => decodeWire('rpc', new Uint8Array(await response.arrayBuffer()))
const post = (url, value) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: encodeWire('rpc', value) })

test('HTTP identity and BigInt status are binary, not JSON or boxed decimal fields', async t => {
  const identity = { schema: 'leofcoin:chain-identity:v1', chainId: 'lfc:' + 'a'.repeat(64) }
  const server = http({ getChainIdentity: async () => identity, lastBlock: { hash: 'test-block', index: 9n, reward: 150n, fees: 10n } }, 0, 'peach')
  t.after(() => server.close())
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(base + '/chainIdentity')
  assert.equal(response.headers.get('content-type'), 'application/octet-stream')
  assert.deepEqual(await read(response), identity)
  assert.equal((await read(await fetch(base + '/lastBlock'))).index, 9n)
  assert.equal((await fetch(base + '/lastBlock?params={}')).status, 405)
  assert.equal((await fetch(base + '/lastBlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 415)
})

test('HTTP native binary parameters preserve exact read values and reject mutation/invalid bytes', async t => {
  const calls = []
  const server = http({ staticCall: async (contract, method, params) => {
    calls.push({ contract, method, params })
    if (method === 'increment') throw new Error('Read-only call attempted to change contract state')
    return method === 'missing' ? null : method === 'name' ? 'Fixture contract' : 2n ** 100n
  } }, 0, 'peach')
  t.after(() => server.close())
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/staticCall`
  const params = ['alice', 9007199254740993n, new Uint8Array([42])]
  assert.equal(await read(await post(url, { contract: 'fixture', method: 'balanceOf', params })), 2n ** 100n)
  assert.deepEqual(calls[0], { contract: 'fixture', method: 'balanceOf', params })
  assert.equal(await read(await post(url, { contract: 'fixture', method: 'name', params: [] })), 'Fixture contract')
  const missing = await post(url, { contract: 'fixture', method: 'missing', params: [] })
  assert.equal(missing.status, 200)
  assert.equal(await read(missing), null)
  assert.equal((await post(url, { contract: 'fixture', method: 'increment', params: [] })).status, 422)
  assert.equal((await post(url, { contract: 'fixture', method: 'name', params: 'not-array' })).status, 400)
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: '{}' })).status, 400)
})

test('Peach admission route returns before finalization and gates network, identity and connectivity', async t => {
  const identity = { network: 'leofcoin:peach', chainId: 'lfc:' + 'b'.repeat(64) }
  let calls = 0
  let fail = false
  const chain = { state: { sync: 'synced' }, getChainIdentity: async () => identity,
    sendTransaction: async transaction => {
      calls++
      assert.equal(transaction.signature, 'signed')
      if (fail) throw new Error('admission failed')
      return { hash: 'test-hash', fee: 2n, wait: new Promise(() => {}) }
    } }
  const previous = globalThis.peernet
  globalThis.peernet = { connections: { fixture: { connected: true } } }
  const server = http(chain, 0, 'peach')
  t.after(() => { server.close(); globalThis.peernet = previous })
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const body = { chainId: identity.chainId, transaction: { signature: 'signed' } }
  const response = await post(base + '/submitTransaction', body)
  assert.equal(response.status, 200)
  assert.deepEqual(await read(response), { status: 'admitted', hash: 'test-hash', fee: 2n, chainId: identity.chainId })
  assert.equal((await post(base + '/submitTransaction', { ...body, chainId: 'wrong' })).status, 409)
  chain.state.sync = 'connectionless'
  assert.equal((await post(base + '/submitTransaction', body)).status, 503)
  chain.state.sync = 'synced'
  globalThis.peernet.connections.fixture.connected = false
  assert.equal((await post(base + '/submitTransaction', body)).status, 503)
  globalThis.peernet.connections.fixture.connected = true
  identity.network = 'leofcoin'
  assert.equal((await post(base + '/submitTransaction', body)).status, 403)
  identity.network = 'leofcoin:peach'
  assert.equal(calls, 1)
  fail = true
  const rejected = await post(base + '/submitTransaction', body)
  assert.equal(rejected.status, 422)
  assert.match((await read(rejected)).error, /admission failed/)
})

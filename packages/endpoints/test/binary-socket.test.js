import test from 'node:test'
import assert from 'node:assert/strict'
import serverFor from '../exports/ws.js'
import WsClient from '../../endpoint-clients/exports/ws.js'

test('actual WebSocket RPC frames are binary in both directions, including BigInt/bytes and errors', async t => {
  const calls = []
  const server = serverFor({ staticCall: async (contract, method, params) => {
    calls.push(params)
    if (method === 'mutate') throw new Error('Read-only mutation rejected')
    return { amount: 1n << 180n, bytes: params[1] }
  } }, 0, 'peach')
  t.after(() => { for (const socket of server.clients) socket.terminate(); server.close() })
  await new Promise(resolve => server.once('listening', resolve))
  let incomingBinary = false
  server.on('connection', socket => socket.on('message', (bytes, binary) => { incomingBinary = binary && bytes instanceof Uint8Array }))
  const url = `ws://127.0.0.1:${server.address().port}`
  const client = new WsClient(url, 'peach')
  await client.init()
  t.after(() => client.client.close())
  let receivedBinary = false
  client.client.socket.addEventListener('message', event => { receivedBinary = event.data instanceof ArrayBuffer })
  const params = [2n ** 90n, Uint8Array.of(0, 255, 42)]
  assert.deepEqual(await client.staticCall('contract', 'quote', params), { amount: 1n << 180n, bytes: params[1] })
  assert.deepEqual(calls[0], params)
  assert.equal(incomingBinary, true)
  assert.equal(receivedBinary, true)
  await assert.rejects(client.staticCall('contract', 'mutate'), /Read-only mutation rejected/)
  assert.equal(client.client.pending.size, 0)
  const legacy = new WebSocket(url, 'peach.lfc-binary-v1')
  await new Promise(resolve => legacy.addEventListener('open', resolve, { once: true }))
  const closed = new Promise(resolve => legacy.addEventListener('close', resolve, { once: true }))
  legacy.send('{"url":"staticCall","params":[]}')
  assert.equal((await closed).code, 1003)
})

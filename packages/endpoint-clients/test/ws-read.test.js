import assert from 'node:assert/strict'
import test from 'node:test'
import WsClient from '../exports/ws.js'

test('WebSocket contract reads preserve bigint query parameters and results without JSON exceptions', async () => {
  const client = new WsClient()
  const requests = []
  client.client = { request: async request => {
    requests.push(request)
    return { value: 2n ** 100n }
  } }
  assert.deepEqual(await client.staticCall('contract', 'quote', [2n ** 80n]), { value: 2n ** 100n })
  assert.deepEqual(requests[0].params.params, [2n ** 80n])
})

test('WebSocket read failures are explicit Error rejections', async () => {
  const client = new WsClient()
  client.client = { request: async () => { throw { error: 'read-only mutation rejected' } } }
  await assert.rejects(client.staticCall('contract', 'increment'), /read-only mutation rejected/)
})

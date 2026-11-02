import assert from 'node:assert/strict'
import test from 'node:test'
import { guardRpcHandler } from '../exports/rpc-handler.js'

test('WebSocket route failures send explicit errors and never escape detached dispatch', async () => {
  const sent = []
  const response = { send: (value, status) => sent.push({ value, status }) }
  for (const handler of [() => { throw new Error('invalid query') }, async () => { throw new Error('read-only mutation rejected') }])
    await guardRpcHandler(handler)({ method: 'increment' }, response)
  assert.deepEqual(sent, [{ value: { error: 'invalid query' }, status: 422 }, { value: { error: 'read-only mutation rejected' }, status: 422 }])
  await assert.doesNotReject(guardRpcHandler(async () => { throw new Error('query rejected') })({}, { send() { throw new Error('socket closed') } }))
})

test('both socket-handler calling conventions preserve native bigint values until binary socket encoding', async () => {
  const sent = []
  const response = { send: (value, status) => { sent.push({ value, status }) } }
  await guardRpcHandler(async ({ send }) => send(2n ** 100n))(response, new Map())
  await guardRpcHandler(async (params, { send }) => send({ value: params.value }))({ value: 5n }, response)
  assert.deepEqual(sent, [{ value: 2n ** 100n, status: 200 }, { value: { value: 5n }, status: 200 }])
})

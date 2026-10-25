import assert from 'node:assert/strict'
import test from 'node:test'
import http from '../exports/http.js'
import { jsonParseBigInt } from '@leofcoin/utils'

test('HTTP advertises the public chain identity without changing state', async (t) => {
  const identity = { schema: 'leofcoin:chain-identity:v1', chainId: 'lfc:' + 'a'.repeat(64) }
  const server = http({ getChainIdentity: async () => identity }, 0, 'peach')
  t.after(() => server.close())
  await new Promise(resolve => server.once('listening', resolve))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/chainIdentity`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), identity)
})

test('HTTP block status serializes canonical bigint fields with the existing JSON codec', async (t) => {
  const server = http({ lastBlock: { hash: 'test-block', index: 9n, reward: 150n, fees: 10n } }, 0, 'peach')
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/lastBlock`)
  assert.equal(response.status, 200)
  const block = JSON.parse(await response.text(), jsonParseBigInt)
  assert.equal(block.index, 9n)
  assert.equal(block.hash, 'test-block')
})

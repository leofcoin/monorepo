import assert from 'node:assert/strict'
import test from 'node:test'
import { FAUCET_SOURCE } from '../dist/templates.js'

test('prefunded faucet enforces lifetime budget, cooldown, sender recipient and owner withdrawal', async t => {
  const calls = []
  const context = { sender: 'operator', contract: 'faucet', call: async (...args) => { calls.push(args) } }
  const Faucet = new Function('msg', `${FAUCET_SOURCE.replace('export default ', '')}; return TestnetFaucet`)(context)
  const faucet = new Faucet('token', '10', 60000, '20')
  assert.equal(faucet.creator, true)
  context.sender = 'alice'
  assert.equal(faucet.creator, false)
  await faucet.claim()
  assert.deepEqual(calls[0], ['token', 'transfer', ['alice', '10']])
  await assert.rejects(faucet.claim(), /cooldown/)
  await assert.rejects(faucet.withdraw('alice', '10'), /owner/)
  context.sender = 'bob'
  await faucet.claim()
  assert.equal(faucet.remainingBudget, 0n)
  context.sender = 'charlie'
  await assert.rejects(faucet.claim(), /budget/)
  context.sender = 'operator'
  await faucet.withdraw('treasury', '5')
  assert.deepEqual(calls.at(-1), ['token', 'transfer', ['treasury', '5']])
  const restored = new Faucet(undefined, undefined, undefined, undefined, JSON.parse(JSON.stringify(faucet.state)))
  assert.deepEqual(restored.state, faucet.state)
  context.sender = 'alice'
  await assert.rejects(restored.claim(), /cooldown/)
  assert.throws(() => new Faucet('token', '0', 60000, '20'), /Invalid/)
  assert.throws(() => new Faucet('token', '10', 0, '20'), /Invalid/)
  assert.throws(() => new Faucet('token', '10', 60000, '5'), /Invalid/)
})

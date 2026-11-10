import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { encodeWire, decodeWire } from '@leofcoin/binary'
import { methods } from '../helpers/canonical-state-harness.js'

const production = methods('../../src/chain.ts', 'Chain', ['#invalidTransaction'])
const source = ts.transpile(`return class Harness {
  receive(bytes) { return this.#invalidTransaction(bytes) }
  ${production}
}`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })

const fixture = () => {
  const pool = new Set(['tx-hash', 'other'])
  const errors = []
  const store = { has: async hash => pool.has(hash), delete: async hash => { pool.delete(hash) } }
  const Harness = new Function('globalThis', 'decodeWire', 'debug', 'console', source)(
    { transactionPoolStore: store }, decodeWire, () => {},
    { log() {}, error: (...args) => errors.push(args) })
  return { chain: new Harness(), pool, errors, store }
}

test('wire-encoded invalid transaction hash is decoded once and removes only its pending entry', async () => {
  const f = fixture()
  await f.chain.receive(encodeWire('invalid-transaction', 'tx-hash'))
  assert.deepEqual([...f.pool], ['other'])
  assert.equal(f.errors.length, 0)
  await f.chain.receive(encodeWire('invalid-transaction', 'tx-hash'))
  assert.equal(f.errors.length, 0)
})

test('malformed peer messages are reported without unhandled rejection or pool changes', async () => {
  for (const bytes of [Uint8Array.of(255), encodeWire('invalid-transaction', { hash: 'tx-hash' }),
    encodeWire('invalid-transaction', ''), encodeWire('wrong-topic', 'tx-hash')]) {
    const f = fixture()
    await f.chain.receive(bytes)
    assert.deepEqual([...f.pool], ['tx-hash', 'other'])
    assert.equal(f.errors.length, 1)
  }
})

test('pool I/O failures remain explicit without crashing pubsub dispatch', async () => {
  for (const operation of ['has', 'delete']) {
    const f = fixture()
    f.store[operation] = async () => { throw new Error('fixture disk failure') }
    await f.chain.receive(encodeWire('invalid-transaction', 'tx-hash'))
    assert.equal(f.pool.has('tx-hash'), true)
    assert.match(f.errors[0][1].message, /disk failure/)
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import LittlePubSub from '@vandeurenglenn/little-pubsub'
import { createCanonicalTransactionWaiter } from '../../src/transaction-finalization.ts'
import { methods } from '../helpers/canonical-state-harness.js'

// Actual admission code, isolated from networking and real wallet/database state.
const code = `return class Submission {
  nonces = new Set()
  isTransactionMessage() { return true }
  async validateTransactionSignature() {}
  async validateNonce() {}
  addPendingNonce(_, nonce) { this.nonces.add(nonce) }
  removePendingNonce(_, nonce) { this.nonces.delete(nonce) }
  ${methods('../../src/transaction.ts', 'Transaction', ['sendTransaction'])}
}`
const js = ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })
const fixture = (options = {}) => {
  const pubsub = new LittlePubSub(), entries = new Map(), warnings = []
  const original = new Error('admission failed')
  const pool = {
    async put(hash, bytes) { if (options.putFailure) throw original; entries.set(hash, bytes) },
    async delete(hash) { if (options.deleteFailure) throw new Error('cleanup failed'); entries.delete(hash) }
  }
  const peernet = { async publish() {
    assert.equal(pubsub.subscriberCount('block-processed'), 1, 'waiter must exist before propagation')
    options.publish?.(pubsub)
    if (options.publishFailure) throw new Error('transport failed')
  } }
  const Submission = new Function('pubsub', 'transactionPoolStore', 'globalThis', 'peernet',
    'createCanonicalTransactionWaiter', 'calculateFee', 'console', js)(
    pubsub, pool, { transactionPoolStore: pool }, peernet, createCanonicalTransactionWaiter,
    async () => { if (options.feeFailure) throw original; return 1n }, { warn(...args) { warnings.push(args) } })
  const message = { decoded: { from: 'sender', nonce: 1 }, encoded: Uint8Array.of(1), async hash() { return 'tx' } }
  return { pubsub, entries, warnings, original, instance: new Submission(), message }
}

for (const failure of ['putFailure', 'feeFailure', 'deleteFailure']) {
  test(`${failure} rejects admission without retaining transaction listeners or nonces`, async () => {
    const state = fixture({ [failure]: true, ...(failure === 'deleteFailure' ? { putFailure: true } : {}) })
    state.instance.nonces.add(1)
    await assert.rejects(state.instance.sendTransaction(state.message), error => error === state.original)
    assert.equal(state.pubsub.subscriberCount('block-processed'), 0)
    assert.equal(state.pubsub.subscriberCount('transaction.completed.tx'), 0)
    // Fee preparation fails before admission and must not touch unrelated state.
    assert.equal(state.instance.nonces.has(1), failure === 'feeFailure')
  })
}

test('transport publication failure retains the durable pool entry and its usable waiter', async () => {
  const state = fixture({ publishFailure: true })
  const pending = await state.instance.sendTransaction(state.message)
  assert.equal(state.entries.has('tx'), true)
  state.pubsub.publish('block-processed', { transactions: ['tx'] })
  assert.equal(await pending.wait, 'tx')
  assert.equal(state.pubsub.subscriberCount('block-processed'), 0)
})

test('failure during propagation is observed before the caller receives its waiter', async () => {
  const state = fixture({ publish(bus) { bus.publish('transaction.completed.tx', { status: 'fail', error: new Error('invalid') }) } })
  const pending = await state.instance.sendTransaction(state.message)
  await assert.rejects(pending.wait, result => result.error.message === 'invalid')
  assert.equal(state.pubsub.subscriberCount('block-processed'), 0)
})

test('pending nonces never become committed state and storage failures are not treated as zero', async () => {
  const source = `return class Nonces {
    getMaxPendingNonce() { return 100 }
    getPendingNonces() { return new Set() }
    ${methods('../../src/transaction.ts', 'Transaction', ['getNonce', 'validateNonce'])}
  }`
  let written = false
  const accountsStore = {
    async has() { return false },
    async put() { written = true },
    async get() { throw new Error('unexpected read') }
  }
  const Nonces = new Function('globalThis', ts.transpile(source, { target: ts.ScriptTarget.ES2022 }))({ accountsStore })
  const instance = new Nonces()
  assert.equal(await instance.getNonce('sender'), 100)
  await instance.validateNonce('sender', 1)
  assert.equal(written, false)
  accountsStore.has = async () => { throw new Error('nonce store unavailable') }
  await assert.rejects(instance.getNonce('sender'), /nonce store unavailable/)
  await assert.rejects(instance.validateNonce('sender', 1), /nonce store unavailable/)
})

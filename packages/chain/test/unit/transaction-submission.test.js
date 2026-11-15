import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import LittlePubSub from '@vandeurenglenn/little-pubsub'
import { TransactionMessage } from '@leofcoin/messages'
import { createTransactionHash, signTransaction } from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { createCanonicalTransactionWaiter } from '../../src/transaction-finalization.ts'
import { methods } from '../helpers/canonical-state-harness.js'

// Actual admission code, isolated from networking and real wallet/database state.
const code = `return class Submission {
  #localNonceReservations = new Set()
  pendingTransactions = { revision: 0 }
  nonces = new Set()
  isTransactionMessage() { return true }
  async validateTransactionSignature(message) { await this.checkSignature?.(message) }
  async validateNonce(from, nonce) { await this.checkNonce?.(from, nonce) }
  addPendingNonce(_, nonce) { this.nonces.add(nonce) }
  removePendingNonce(_, nonce) { this.nonces.delete(nonce) }
  ${methods('../../src/transaction.ts', 'Transaction', ['sendTransaction', '#admitTransaction', 'admitTransactions'])}
}`
const js = ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })
const fixture = (options = {}) => {
  const pubsub = new LittlePubSub(), entries = new Map(), warnings = []
  const original = new Error('admission failed')
  const pool = {
    atomicBatchWrites: true,
    async put(hash, bytes) { if (options.putFailure) throw original; entries.set(hash, bytes) },
    async batch(operations) {
      if (options.batchFailure) throw original
      for (const { key, value } of operations) entries.set(key, value)
    },
    async delete(hash) { if (options.deleteFailure) throw new Error('cleanup failed'); entries.delete(hash) }
  }
  const peernet = { async publish() {
    assert.ok(pubsub.subscriberCount('block-processed') >= 1, 'waiter must exist before propagation')
    options.publish?.(pubsub)
    if (options.publishFailure) throw new Error('transport failed')
  } }
  const Submission = new Function('pubsub', 'transactionPoolStore', 'globalThis', 'peernet',
    'createCanonicalTransactionWaiter', 'calculateFee', 'console', js)(
    pubsub, pool, { transactionPoolStore: pool }, peernet, createCanonicalTransactionWaiter,
    async () => { if (options.feeFailure) throw original; return 1n }, { warn(...args) { warnings.push(args) } })
  const message = { decoded: { from: 'sender', nonce: 1 }, encoded: Uint8Array.of(1), async hash() { return 'tx' } }
  return { pubsub, entries, pool, warnings, original, instance: new Submission(), message }
}

test('batch admission writes atomically and returns individual canonical waiters', async () => {
  const state = fixture()
  const messages = [1, 2].map(nonce => ({
    decoded: { from: 'sender', nonce }, encoded: Uint8Array.of(nonce), async hash() { return `tx-${nonce}` }
  }))
  const receipts = await state.instance.admitTransactions(messages)
  assert.deepEqual([...state.entries.keys()], ['tx-1', 'tx-2'])
  assert.deepEqual([...state.instance.nonces], [1, 2])
  state.pubsub.publish('block-processed', { transactions: ['tx-1', 'tx-2'] })
  assert.deepEqual(await Promise.all(receipts.map(receipt => receipt.wait)), ['tx-1', 'tx-2'])
})

test('batch validation, duplicate nonces, non-atomic storage and write failures leave no admissions', async () => {
  for (const mode of ['signature', 'duplicate', 'non-atomic', 'batchFailure', 'revision']) {
    const state = fixture({ batchFailure: mode === 'batchFailure' })
    const messages = [1, mode === 'duplicate' ? 1 : 2].map(nonce => ({
      decoded: { from: 'sender', nonce }, encoded: Uint8Array.of(nonce), async hash() { return `tx-${nonce}` }
    }))
    if (mode === 'signature') state.instance.checkSignature = async message => {
      if (message.decoded.nonce === 2) throw new Error('invalid signature')
    }
    if (mode === 'revision') state.instance.checkNonce = async () => { state.instance.pendingTransactions.revision++ }
    if (mode === 'non-atomic') {
      // The fixture uses the same store object in its global and closure bindings.
      state.pool.atomicBatchWrites = false
    }
    await assert.rejects(state.instance.admitTransactions(messages))
    assert.equal(state.entries.size, 0, mode)
    assert.equal(state.instance.nonces.size, 0, mode)
    assert.equal(state.pubsub.subscriberCount('block-processed'), 0, mode)
  }
})

test('a concurrent single submission cannot reserve the same nonce as an in-flight batch', async () => {
  const state = fixture()
  let release, entered
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { entered = resolve })
  state.instance.checkNonce = async () => { entered(); await gate }
  const batching = state.instance.admitTransactions([state.message])
  await started
  await assert.rejects(state.instance.sendTransaction(state.message), /same nonce/)
  release()
  const [receipt] = await batching
  state.pubsub.publish('block-processed', { transactions: ['tx'] })
  assert.equal(await receipt.wait, 'tx')
})

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

const signatureHarness = (Verifier = MultiWallet) => {
  const code = `return class Signatures {
    #signatureChecks = new Map()
    #signatureVerifiers = new Map()
    isTransactionMessage(message) { return message instanceof TransactionMessage }
    ${methods('../../src/transaction.ts', 'Transaction', ['validateTransactionSignature'])}
  }`
  let network = 'leofcoin:peach'
  const Signatures = new Function(
    'TransactionMessage', 'MultiWallet', 'fromBase58', 'createTransactionHash', 'sha256', 'bytesToHex',
    'chainNetwork', ts.transpile(code, { target: ts.ScriptTarget.ES2022 })
  )(TransactionMessage, Verifier, fromBase58, createTransactionHash, sha256, bytesToHex, () => network)
  return { instance: new Signatures(), setNetwork(value) { network = value } }
}

test('reuses sender verifier initialization only within its network and retries initialization failures', async () => {
  let initializations = 0, checks = 0
  class Verifier {
    async fromAddress(address) {
      initializations++
      if (address === 'bad') throw new Error('address unavailable')
    }
    async verify() { checks++; return true }
  }
  const { instance, setNetwork } = signatureHarness(Verifier)
  const message = (from, nonce) => new TransactionMessage({
    from, to: 'recipient', method: 'transfer', params: [], nonce, timestamp: 1, signature: '1'
  })
  await Promise.all([instance.validateTransactionSignature(message('alice', 1)),
    instance.validateTransactionSignature(message('alice', 2))])
  assert.equal(initializations, 1)
  assert.equal(checks, 2)
  await instance.validateTransactionSignature(message('bob', 1))
  assert.equal(initializations, 2)
  setNetwork('leofcoin:e2e')
  await instance.validateTransactionSignature(message('alice', 3))
  assert.equal(initializations, 3)
  await assert.rejects(instance.validateTransactionSignature(message('bad', 1)), /address unavailable/)
  await assert.rejects(instance.validateTransactionSignature(message('bad', 1)), /address unavailable/)
  assert.equal(initializations, 5)
})

test('bounds cached sender verifiers and reinitializes an evicted sender', async () => {
  let initializations = 0
  class Verifier {
    async fromAddress() { initializations++ }
    async verify() { return true }
  }
  const { instance } = signatureHarness(Verifier)
  const message = (from, nonce) => new TransactionMessage({
    from, to: 'recipient', method: 'transfer', params: [], nonce, timestamp: 1, signature: '1'
  })
  for (let index = 0; index <= 512; index++)
    await instance.validateTransactionSignature(message(`sender-${index}`, 1))
  assert.equal(initializations, 513)
  await instance.validateTransactionSignature(message('sender-0', 2))
  assert.equal(initializations, 514)
})

test('identical signed bytes share verification, but changed signatures and payloads never reuse success', async () => {
  const signer = new MultiWallet('leofcoin:peach')
  await signer.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1), undefined, 'leofcoin:peach')
  const signed = await signTransaction({
    from: await signer.address, to: 'recipient', method: 'transfer', params: ['recipient', 1n], nonce: 1, timestamp: 1
  }, signer)
  let checks = 0
  class Verifier extends MultiWallet {
    async verify(...args) { checks++; return super.verify(...args) }
  }
  const { instance } = signatureHarness(Verifier)
  await Promise.all(Array.from({ length: 8 }, () => instance.validateTransactionSignature(new TransactionMessage(signed))))
  assert.equal(checks, 1)
  const changedSignature = new TransactionMessage({ ...signed, signature: 'invalid' })
  assert.deepEqual(
    await createTransactionHash(changedSignature), await createTransactionHash(new TransactionMessage(signed)),
    'signing-payload hash alone cannot key signature checks'
  )
  await assert.rejects(instance.validateTransactionSignature(changedSignature), /signature/)
  const mutated = new TransactionMessage(signed)
  await instance.validateTransactionSignature(mutated)
  mutated.decoded.params[1] = 2n
  await assert.rejects(instance.validateTransactionSignature(mutated), /signature/)
  await instance.validateTransactionSignature(new TransactionMessage({ ...signed, params: ['recipient', 1n] }))
})

test('failed signature checks can retry and verification is scoped to the network', async () => {
  let checks = 0
  class Verifier {
    async fromAddress() {}
    async verify() { checks++; if (checks === 1) throw new Error('verifier unavailable'); return true }
  }
  const { instance, setNetwork } = signatureHarness(Verifier)
  const message = new TransactionMessage({
    from: 'sender', to: 'recipient', method: 'transfer', params: [], nonce: 1, timestamp: 1, signature: '1'
  })
  await assert.rejects(instance.validateTransactionSignature(message), /verifier unavailable/)
  await instance.validateTransactionSignature(message)
  await instance.validateTransactionSignature(message)
  assert.equal(checks, 2)
  setNetwork('leofcoin:e2e')
  await instance.validateTransactionSignature(message)
  assert.equal(checks, 3)
})

test('signature verification retains a deep pending batch but still evicts old successes', async () => {
  let checks = 0
  class Verifier {
    async fromAddress() {}
    async verify() { checks++; return true }
  }
  const { instance } = signatureHarness(Verifier)
  const transaction = nonce => new TransactionMessage({
    from: 'sender', to: 'recipient', method: 'transfer', params: [], nonce, timestamp: 1, signature: '1'
  })
  for (let nonce = 1; nonce <= 8192; nonce++) await instance.validateTransactionSignature(transaction(nonce))
  await instance.validateTransactionSignature(transaction(1))
  assert.equal(checks, 8192)
  for (let nonce = 8193; nonce <= 16385; nonce++) await instance.validateTransactionSignature(transaction(nonce))
  await instance.validateTransactionSignature(transaction(16385))
  assert.equal(checks, 16385)
  await instance.validateTransactionSignature(transaction(1))
  assert.equal(checks, 16386)
})

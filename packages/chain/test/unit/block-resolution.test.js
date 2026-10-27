import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { TransactionMessage } from '@leofcoin/messages'
import { ResolveError } from '@leofcoin/errors'
import { resolveTransactionReference } from '../../src/consensus/transaction-reference.ts'
import { methods, deferred } from '../helpers/canonical-state-harness.js'

const production = methods('../../src/state.ts', 'State', [
  '#resolveTransactions', '#resolveBlock', 'resolveBlock'
])
const source = ts.transpile(`
  return class Harness {
    #blocks = []
    #blockHashMap = new Map()
    #totalSize = 0
    #lastResolved
    #lastResolvedTime = 0
    #resolveErrored = false
    #resolvingHashes = new Map()
    #resolving = false
    wantList = []
    tip = { hash: '0x0' }
    jobber = { add() { throw new Error('must not time out the whole ancestry') } }
    canonicalTip() { return Promise.resolve(this.tip) }
    getAndPutBlock(hash) { return boundary.block(hash) }
    get blocks() { return this.#blocks }
    get resolving() { return this.#resolving }
    ${production}
  }
`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })

const harness = (blocks, options = {}) => {
  const reads = []
  const transactions = new Map()
  const events = []
  const warnings = []
  const pool = new Set()
  const transactionStore = {
    async has(hash) { return transactions.has(hash) },
    async put(hash, bytes) { transactions.set(hash, bytes) }
  }
  const transactionPoolStore = {
    async has(hash) { return pool.has(hash) },
    async delete(hash) { pool.delete(hash) }
  }
  const peernet = { get: options.get ?? (async () => undefined) }
  const globals = {
    pubsub: { publish(topic, value) { events.push([topic, value]) } }
  }
  const boundary = {
    async block(hash) {
      reads.push(hash)
      await options.beforeBlock?.(hash)
      const decoded = blocks.get(hash)
      if (!decoded) throw new Error(`unavailable block ${hash}`)
      return { decoded, encoded: Uint8Array.of(1) }
    }
  }
  const Harness = new Function(
    'boundary', 'globalThis', 'peernet', 'transactionStore', 'transactionPoolStore',
    'resolveTransactionReference', 'ResolveError', 'debug', 'formatBytes', 'console', source
  )(
    boundary, globals, peernet, transactionStore, transactionPoolStore,
    resolveTransactionReference, ResolveError, () => {}, String,
    { error(...args) { warnings.push(args) } }
  )
  return { chain: new Harness(), reads, transactions, events, pool, warnings }
}

const ancestry = (length) => new Map(Array.from({ length }, (_, index) => [
  `block-${index}`, { index, previousHash: index === 0 ? '0x0' : `block-${index - 1}`, transactions: [] }
]))
const transaction = new TransactionMessage({
  from: 'sender', to: 'recipient', method: 'transfer', params: ['recipient', 1n],
  timestamp: 1, nonce: 1, signature: 'signature'
})

test('resolves a long ancestry iteratively with one block fetch in flight', async () => {
  let active = 0
  let maximum = 0
  const state = harness(ancestry(2000), {
    async beforeBlock() {
      active++
      maximum = Math.max(maximum, active)
      await Promise.resolve()
      active--
    }
  })
  await state.chain.resolveBlock('block-1999')
  assert.equal(state.chain.blocks.length, 2000)
  assert.equal(state.events.length, 2000)
  assert.equal(maximum, 1)
  assert.equal(state.chain.resolving, false)
  assert.deepEqual(state.chain.tip, { hash: '0x0' }, 'resolution must not apply canonical state')
})

test('duplicate callers await the same in-flight ancestry rather than returning early', async () => {
  const gate = deferred()
  const state = harness(ancestry(2), { beforeBlock: () => gate.promise })
  let firstDone = false
  let secondDone = false
  const first = state.chain.resolveBlock('block-1').then(() => { firstDone = true })
  const second = state.chain.resolveBlock('block-1').then(() => { secondDone = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(firstDone, false)
  assert.equal(secondDone, false)
  gate.resolve()
  await Promise.all([first, second])
  assert.deepEqual(state.reads, ['block-1', 'block-0'])
})

test('retries missing transaction data without refetching completed descendants', async () => {
  const blocks = ancestry(3)
  const hash = await transaction.hash()
  blocks.get('block-1').transactions = [hash]
  let attempts = 0
  const state = harness(blocks, {
    async get(requested, store) {
      assert.equal(requested, hash)
      assert.equal(store, 'transaction')
      return ++attempts === 1 ? undefined : transaction.encoded
    }
  })
  await state.chain.resolveBlock('block-2')
  assert.deepEqual(state.reads, ['block-2', 'block-1', 'block-1', 'block-0'])
  assert.equal(state.chain.blocks.length, 3)
  assert.deepEqual(state.transactions.get(hash), transaction.encoded)
})

test('unavailable ancestry fails after three attempts and can be retried later', async () => {
  const blocks = ancestry(2)
  blocks.delete('block-0')
  const state = harness(blocks)
  await assert.rejects(state.chain.resolveBlock('block-1'), /block: block-1/)
  assert.equal(state.reads.filter(hash => hash === 'block-0').length, 3)
  assert.deepEqual(state.chain.wantList, ['block-1'])
  assert.equal(state.chain.resolving, false)
  blocks.set('block-0', { index: 0, previousHash: '0x0', transactions: [] })
  await state.chain.resolveBlock('block-1')
  assert.equal(state.chain.blocks.length, 2)
})

test('rejects mismatched transaction bytes without caching the block or corrupting the store', async () => {
  const blocks = ancestry(1)
  blocks.get('block-0').transactions = ['wrong-hash']
  const state = harness(blocks, { get: async () => transaction.encoded })
  await assert.rejects(state.chain.resolveBlock('block-0'), /block: block-0/)
  assert.equal(state.chain.blocks.length, 0)
  assert.equal(state.transactions.size, 0)
})

test('stops at the canonical tip and rejects cyclic ancestry', async () => {
  const state = harness(ancestry(4))
  state.chain.tip = { hash: 'block-1' }
  await state.chain.resolveBlock('block-3')
  assert.deepEqual(state.reads, ['block-3', 'block-2'])

  const blocks = ancestry(2)
  blocks.get('block-0').previousHash = 'block-1'
  const cyclic = harness(blocks)
  await assert.rejects(cyclic.chain.resolveBlock('block-1'), error =>
    error.cause.message.includes('cyclic block ancestry'))
})

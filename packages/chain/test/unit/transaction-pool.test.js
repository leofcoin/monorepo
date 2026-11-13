import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { TransactionMessage } from '@leofcoin/messages'
import { methods } from '../helpers/canonical-state-harness.js'

import {
  compareTransactionNonces,
  compareLegacyExecutionTransactions,
  compareExecutionTransactions,
  enqueueTransaction,
  pruneCanonicalTransactions,
  PendingTransactionIndex,
  validateConsecutiveNonces
} from '../../src/consensus/transaction-pool.ts'

const transaction = (hash) => ({ hash: async () => hash })

test('removes recent canonical transactions from the pending pool', async () => {
  const removed = []
  const pending = await pruneCanonicalTransactions(
    [transaction('recent'), transaction('stored'), transaction('pending')],
    ['recent'],
    async (hash) => removed.push(hash)
  )

  assert.deepEqual(removed, ['recent'])
  assert.deepEqual(
    pending.map(({ hash }) => hash),
    ['stored', 'pending']
  )
})

test('stores validated incoming transactions and tracks their pending nonce', async () => {
  const stored = []
  const pending = []
  const tx = {
    encoded: Uint8Array.of(1),
    decoded: { from: 'alice', nonce: 7 },
    hash: async () => 'tx-1'
  }

  const hash = await enqueueTransaction(tx, {
    putToPool: async (txHash, data) => stored.push([txHash, data]),
    hasInPool: async () => false,
    addPendingNonce: (address, nonce) => pending.push([address, nonce])
  })

  assert.equal(hash, 'tx-1')
  assert.deepEqual(stored, [['tx-1', tx.encoded]])
  assert.deepEqual(pending, [['alice', 7]])
})

test('prunes lower and equal committed nonces even when their hashes are not canonical', async () => {
  const removed = []
  const entries = [334, 11167, 11168].map(nonce => ({
    decoded: { from: 'sender', nonce },
    hash: async () => `tx-${nonce}`
  }))
  const pending = await pruneCanonicalTransactions(
    entries, [],
    async (hash, transaction) => removed.push([hash, transaction.decoded.nonce]),
    async transaction => BigInt(transaction.decoded.nonce) <= 11167n
  )
  assert.deepEqual(removed, [['tx-334', 334], ['tx-11167', 11167]])
  assert.deepEqual(pending.map(({ hash }) => hash), ['tx-11168'])
})

test('a failed committed nonce read stops proposal preparation instead of assuming zero', async () => {
  const removed = []
  await assert.rejects(pruneCanonicalTransactions(
    [transaction('pending')], [],
    async hash => removed.push(hash),
    async () => { throw new Error('nonce store unavailable') }
  ), /nonce store unavailable/)
  assert.deepEqual(removed, [])
})

test('does not store a duplicate transaction but still restores its nonce index', async () => {
  let writes = 0
  const pending = []
  const tx = {
    encoded: Uint8Array.of(1),
    decoded: { from: 'alice', nonce: 8 },
    hash: async () => 'tx-2'
  }

  await enqueueTransaction(tx, {
    putToPool: async () => {
      writes += 1
    },
    hasInPool: async () => true,
    addPendingNonce: (address, nonce) => pending.push([address, nonce])
  })

  assert.equal(writes, 0)
  assert.deepEqual(pending, [['alice', 8]])
})

test('orders number, bigint, and encoded string nonces without mixing arithmetic types', () => {
  const nonces = [4n, 2, '3', 1n]
  nonces.sort(compareTransactionNonces)
  assert.deepEqual(nonces, [1n, 2, '3', 4n])
})

test('block nonces must be consecutive per sender, independent of priority or arrival order', async () => {
  const tx = (from, nonce, priority = false) => ({ decoded: { from, nonce, priority } })
  const read = async address => address === 'alice' ? 13n : 0n
  const valid = [tx('alice', 15, true), tx('bob', 1), tx('alice', 14)]
  await validateConsecutiveNonces(valid, read)
  assert.deepEqual([...valid].sort(compareExecutionTransactions).map(item => item.decoded.nonce), [1, 14, 15])
  await assert.rejects(validateConsecutiveNonces([tx('alice', 11167)], read), /expected 14, got 11167/)
  await assert.rejects(validateConsecutiveNonces([tx('alice', 14), tx('alice', 14)], read), /expected 15, got 14/)
  await assert.rejects(validateConsecutiveNonces([tx('bob', 1)], async () => { throw new Error('disk failure') }), /disk failure/)
})

test('historical blocks preserve 0.5 priority-first transaction execution order', () => {
  const tx = (nonce, priority = false) => ({ decoded: { nonce, priority } })
  const transactions = [tx(1), tx(2, true), tx(1, true), tx(0)]
  assert.deepEqual(
    transactions.sort(compareLegacyExecutionTransactions).map(({ decoded }) => [decoded.priority, decoded.nonce]),
    [[true, 1], [true, 2], [false, 0], [false, 1]]
  )
})

test('real proposal selection finds the missing nonce beyond the old pool limit and defers gaps', async () => {
  const source = methods('../../src/chain.ts', 'Chain', ['#createBlock'])
  const ast = ts.createSourceFile('proposal.ts', `class Proposal { ${source} }`, ts.ScriptTarget.Latest, true)
  const statements = ast.statements[0].members[0].body.statements
  const end = statements.findIndex(statement => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'localBlock'))
  assert.ok(end > 0)
  const body = statements.slice(0, end).map(statement => statement.getText(ast)).join('\n')
  const script = ts.transpileModule(`class Proposal {
    #proposalInFlight = null
    transactionLimit = 2500
    version = '0.6.0'
    machine = { latestTransactions: async () => [] }
    promiseTransactions(transactions) { return transactions }
    removePendingNonce() {}
    pendingTransactions = index
    async validateTransactionSignature() {}
    async create() { ${body}; return block }
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const tx = (from, nonce, priority = false) => ({
    decoded: { from, nonce, priority }, encoded: Uint8Array.of(1),
    hash: async () => `${from}-${nonce}`
  })
  const pool = [tx('alice', 2, true), tx('bob', 3)]
  for (let nonce = 1000; nonce < 3500; nonce++) pool.push(tx('alice', nonce))
  pool.push(tx('alice', 1), tx('bob', 1))
  const index = new PendingTransactionIndex()
  const byHash = new Map()
  for (const transaction of pool) {
    const hash = await transaction.hash()
    byHash.set(hash, transaction)
    index.add(hash, transaction, 0n)
  }
  const reads = []
  const fake = {
    transactionPoolStore: {
      async values() { throw new Error('proposal must not scan the full pool') },
      async get(hash) { reads.push(hash); return byHash.get(hash) },
      async delete() {} },
    transactionStore: { async has() { return true } },
    accountsStore: { async has() { return false } },
    peernet: { async put() {} }
  }
  const Proposal = new Function('globalThis', 'index', 'resolveTransactionReference',
    'MAX_TRANSACTION_BYTES', 'MAX_BLOCK_TRANSACTION_BYTES', 'MAX_BLOCK_TRANSACTIONS', 'supportsTransactionFees',
    'calculateFee', `${script}; return Proposal`)(fake, index, async (_hash, transaction) => transaction,
    1000, 1000, 256, () => false, async () => 0n)
  const block = await new Proposal().create()
  assert.deepEqual(reads, ['alice-1', 'bob-1', 'alice-2'])
  assert.deepEqual(block.transactions, ['alice-1', 'bob-1', 'alice-2'])
})

test('pending index preserves nonce, priority and hash order across senders and defers gaps', () => {
  const index = new PendingTransactionIndex()
  const add = (hash, from, nonce, priority = false) => index.add(hash, { decoded: { from, nonce, priority } }, 0n)
  add('alice-2', 'alice', 2)
  add('alice-3', 'alice', 3)
  add('alice-1-z', 'alice', 1)
  add('alice-1-a', 'alice', 1)
  add('bob-1', 'bob', 1, true)
  add('gap-2', 'gap', 2)
  assert.deepEqual([...index.candidates()].map(entry => entry.hash), ['bob-1', 'alice-1-a', 'alice-2', 'alice-3'])
  assert.deepEqual(index.commit('alice', 1n).map(entry => entry.hash).sort(), ['alice-1-a', 'alice-1-z'])
  assert.deepEqual([...index.candidates()].map(entry => entry.hash), ['bob-1', 'alice-2', 'alice-3'])
  index.remove('bob-1')
  assert.equal(index.hasNonce('bob', 1n), false)
  const candidates = index.candidates()
  assert.equal(candidates.next().value.hash, 'alice-2')
  assert.equal(candidates.next(false).done, true, 'rejecting a nonce must not make its successors executable')
})

test('pending index retains large future ranges while selecting only a bounded consecutive prefix', () => {
  const index = new PendingTransactionIndex()
  for (let nonce = 2; nonce <= 10000; nonce++)
    index.add(`tx-${nonce}`, { decoded: { from: 'sender', nonce } }, 0n)
  assert.equal(index.candidates().next().done, true)
  index.add('tx-1', { decoded: { from: 'sender', nonce: 1 } }, 0n)
  const selected = []
  for (const transaction of index.candidates()) {
    selected.push(transaction.nonce)
    if (selected.length === 256) break
  }
  assert.equal(selected[0], 1n)
  assert.equal(selected.at(-1), 256n)
  assert.equal(index.commit('sender', 256n).length, 256)
  assert.equal(index.candidates().next().value.nonce, 257n)
  assert.equal(index.size, 9744)
  assert.equal(index.commit('sender', 9_000_000_000_000_000n).length, 9744, 'historical jumps must not walk the numeric gap')
  assert.equal(index.size, 0)
})

test('indexed selection matches full-sort selection with different committed nonces, alternatives and gaps', () => {
  const index = new PendingTransactionIndex()
  const entries = [], committed = new Map()
  for (let sender = 0; sender < 8; sender++) {
    const from = `sender-${sender}`, base = BigInt(sender % 3)
    committed.set(from, base)
    for (let nonce = Number(base) + 1; nonce < 9; nonce++) {
      if (sender % 2 && nonce === Number(base) + 3) continue
      for (let alternative = 0; alternative < 2; alternative++) {
        const transaction = { decoded: { from, nonce, priority: Boolean(alternative) } }
        const hash = `${from}-${nonce}-${alternative}`
        index.add(hash, transaction, base)
        entries.push({ transaction, hash })
      }
    }
  }
  entries.sort((a, b) => compareExecutionTransactions(a.transaction, b.transaction) || a.hash.localeCompare(b.hash))
  const expected = []
  for (const { transaction, hash } of entries) {
    const { from, nonce } = transaction.decoded
    if (BigInt(nonce) !== committed.get(from) + 1n) continue
    expected.push(hash)
    committed.set(from, BigInt(nonce))
  }
  assert.deepEqual([...index.candidates()].map(entry => entry.hash), expected)
})

test('restart rebuilds the metadata and pending-nonce indexes and prunes already committed entries', async () => {
  const messages = [1, 2, 4].map(nonce => new TransactionMessage({
    from: 'sender', to: 'token', method: 'transfer', params: ['recipient', 1n], nonce, timestamp: 1, signature: 'fixture'
  }))
  const removed = []
  const globals = {
    transactionPoolStore: { async values() { return messages.map(tx => tx.encoded) }, async delete(hash) { removed.push(hash) } },
    accountsStore: { async has() { return true }, async get() { return new TextEncoder().encode('1') } }
  }
  const js = ts.transpileModule(`return new class {
    pendingTransactions = new PendingTransactionIndex()
    nonces = []
    clearPendingTransactionIndex() { this.pendingTransactions.clear(); this.nonces = [] }
    addPendingNonce(from, nonce) { this.nonces.push([from, nonce]) }
    ${methods('../../src/transaction.ts', 'Transaction', ['restorePendingTransactions'])}
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const instance = new Function('globalThis', 'TransactionMessage', 'PendingTransactionIndex', js)(
    globals, TransactionMessage, PendingTransactionIndex
  )
  await instance.restorePendingTransactions()
  assert.deepEqual(removed, [await messages[0].hash()])
  assert.deepEqual(instance.nonces, [['sender', 2], ['sender', 4]])
  assert.deepEqual([...instance.pendingTransactions.candidates()].map(entry => entry.nonce), [2n])
  globals.accountsStore.get = async () => { throw new Error('nonce read failed') }
  await assert.rejects(instance.restorePendingTransactions(), /nonce read failed/)
})

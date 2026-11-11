import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { methods } from '../helpers/canonical-state-harness.js'

import {
  compareTransactionNonces,
  compareExecutionTransactions,
  enqueueTransaction,
  pruneCanonicalTransactions,
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
  let requestedLimit
  const fake = {
    transactionPoolStore: { async size() { return pool.length }, async values(limit) { requestedLimit = limit; return pool },
      async delete() {} },
    transactionStore: { async has() { return true } },
    accountsStore: { async has() { return false } },
    peernet: { async put() {} }
  }
  const Proposal = new Function('globalThis', 'pruneCanonicalTransactions', 'compareExecutionTransactions',
    'MAX_TRANSACTION_BYTES', 'MAX_BLOCK_TRANSACTION_BYTES', 'MAX_BLOCK_TRANSACTIONS', 'supportsTransactionFees',
    'calculateFee', `${script}; return Proposal`)(fake, pruneCanonicalTransactions, compareExecutionTransactions,
    1000, 1000, 256, () => false, async () => 0n)
  const block = await new Proposal().create()
  assert.equal(requestedLimit, undefined)
  assert.deepEqual(block.transactions, ['alice-1', 'bob-1', 'alice-2'])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareTransactionNonces,
  enqueueTransaction,
  pruneCanonicalTransactions
} from '../../src/consensus/transaction-pool.ts'

const transaction = (hash) => ({ hash: async () => hash })

test('removes recent and persisted canonical transactions from the pending pool', async () => {
  const removed = []
  const pending = await pruneCanonicalTransactions(
    [transaction('recent'), transaction('stored'), transaction('pending')],
    ['recent'],
    async (hash) => hash === 'stored',
    async (hash) => removed.push(hash)
  )

  assert.deepEqual(removed, ['recent', 'stored'])
  assert.deepEqual(
    pending.map(({ hash }) => hash),
    ['pending']
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
    hasInStore: async () => false,
    addPendingNonce: (address, nonce) => pending.push([address, nonce])
  })

  assert.equal(hash, 'tx-1')
  assert.deepEqual(stored, [['tx-1', tx.encoded]])
  assert.deepEqual(pending, [['alice', 7]])
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
    hasInStore: async () => false,
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

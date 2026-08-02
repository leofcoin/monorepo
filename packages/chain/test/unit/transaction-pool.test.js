import assert from 'node:assert/strict'
import test from 'node:test'

import { compareTransactionNonces, pruneCanonicalTransactions } from '../../src/consensus/transaction-pool.ts'

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

test('orders number, bigint, and encoded string nonces without mixing arithmetic types', () => {
  const nonces = [4n, 2, '3', 1n]
  nonces.sort(compareTransactionNonces)
  assert.deepEqual(nonces, [1n, 2, '3', 4n])
})

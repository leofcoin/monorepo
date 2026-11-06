import assert from 'node:assert/strict'
import test from 'node:test'
import LittlePubSub from '@vandeurenglenn/little-pubsub'

import { waitForCanonicalTransaction, createCanonicalTransactionWaiter } from '../../src/transaction-finalization.ts'

const createPubSub = () => {
  const handlers = new Map()
  return {
    subscribe(topic, handler) {
      const topicHandlers = handlers.get(topic) ?? new Set()
      topicHandlers.add(handler)
      handlers.set(topic, topicHandlers)
    },
    unsubscribe(topic, handler) {
      handlers.get(topic)?.delete(handler)
    },
    publish(topic, value) {
      for (const handler of handlers.get(topic) ?? []) handler(value)
    },
    subscribers(topic) {
      return handlers.get(topic)?.size ?? 0
    }
  }
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve))

test('resolves only when a canonical block contains the exact transaction hash', async () => {
  const pubsub = createPubSub()
  const transactionPool = { delete: async () => undefined }
  let settled = false
  const wait = waitForCanonicalTransaction(pubsub, transactionPool, 'tx-1').finally(() => {
    settled = true
  })

  pubsub.publish('transaction.completed.tx-1', { status: 'fulfilled', hash: 'tx-1' })
  pubsub.publish('block-processed', { transactions: ['tx-10', 'tx-2'] })
  await nextTurn()
  assert.equal(settled, false)

  pubsub.publish('block-processed', { transactions: ['tx-1'] })
  assert.equal(await wait, 'tx-1')
  assert.equal(pubsub.subscribers('block-processed'), 0)
  assert.equal(pubsub.subscribers('transaction.completed.tx-1'), 0)
})

test('rejects an invalid transaction and removes it from the pool', async () => {
  const pubsub = createPubSub()
  const removed = []
  const transactionPool = { delete: async (hash) => removed.push(hash) }
  const wait = waitForCanonicalTransaction(pubsub, transactionPool, 'tx-invalid')

  pubsub.publish('transaction.completed.tx-invalid', { status: 'fail', error: new Error('invalid') })

  await assert.rejects(wait, (result) => result.hash === 'tx-invalid' && result.error.message === 'invalid')
  assert.deepEqual(removed, ['tx-invalid'])
  assert.equal(pubsub.subscribers('block-processed'), 0)
})

test('the real event bus settles every waiter without mutating an active dispatch', async () => {
  const pubsub = new LittlePubSub()
  const hashes = Array.from({ length: 128 }, (_, index) => `tx-${index}`)
  const waits = hashes.map(hash => waitForCanonicalTransaction(pubsub, { delete: async () => {} }, hash))
  let observed = 0
  pubsub.subscribe('block-processed', () => observed++)
  assert.doesNotThrow(() => pubsub.publish('block-processed', { transactions: hashes }))
  assert.deepEqual(await Promise.all(waits), hashes)
  assert.equal(observed, 1)
  assert.equal(pubsub.subscriberCount('block-processed'), 1)
  for (const hash of hashes) assert.equal(pubsub.subscriberCount(`transaction.completed.${hash}`), 0)
})

test('cached canonical notification is safe during waiter subscription', async () => {
  const pubsub = new LittlePubSub()
  pubsub.publish('block-processed', { transactions: ['tx-cached'] })
  assert.equal(await waitForCanonicalTransaction(pubsub, { delete: async () => {} }, 'tx-cached'), 'tx-cached')
  assert.equal(pubsub.subscriberCount('block-processed'), 0)
  assert.equal(pubsub.subscriberCount('transaction.completed.tx-cached'), 0)
})

test('pool deletion failures reject and clean up rather than leaking a pending waiter', async () => {
  const pubsub = new LittlePubSub()
  const wait = waitForCanonicalTransaction(pubsub, { delete: async () => { throw new Error('store unavailable') } }, 'tx-invalid')
  pubsub.publish('transaction.completed.tx-invalid', { status: 'fail', error: new Error('invalid') })
  await assert.rejects(wait, result => result.error.message === 'store unavailable' && result.transactionError.message === 'invalid')
  assert.equal(pubsub.subscriberCount('block-processed'), 0)
  assert.equal(pubsub.subscriberCount('transaction.completed.tx-invalid'), 0)
})

test('a canonical success cannot subsequently delete the transaction as a failure', async () => {
  const pubsub = new LittlePubSub()
  let deleted = false
  const wait = waitForCanonicalTransaction(pubsub, { delete: async () => { deleted = true } }, 'tx-ok')
  pubsub.publish('block-processed', { transactions: ['tx-ok'] })
  pubsub.publish('transaction.completed.tx-ok', { status: 'fail', error: new Error('stale failure') })
  assert.equal(await wait, 'tx-ok')
  assert.equal(deleted, false)
})

test('cancelling a submission cleans both listeners without deleting shared pool data', async () => {
  const pubsub = new LittlePubSub(), removed = []
  const waiter = createCanonicalTransactionWaiter(pubsub, { delete: async hash => removed.push(hash) }, 'tx-cancel')
  const error = new Error('submission cancelled')
  waiter.cancel(error)
  waiter.cancel(new Error('duplicate cancellation'))
  await assert.rejects(waiter.wait, result => result.hash === 'tx-cancel' && result.error === error)
  assert.equal(pubsub.subscriberCount('block-processed'), 0)
  assert.equal(pubsub.subscriberCount('transaction.completed.tx-cancel'), 0)
  assert.deepEqual(removed, [])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { waitForCanonicalTransaction } from '../../src/transaction-finalization.ts'

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

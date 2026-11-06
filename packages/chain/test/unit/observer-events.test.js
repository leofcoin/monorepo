import assert from 'node:assert/strict'
import test from 'node:test'
import LittlePubSub from '@vandeurenglenn/little-pubsub'
import { publishObserverEvent } from '../../src/observer-events.ts'
import { waitForCanonicalTransaction } from '../../src/transaction-finalization.ts'

test('throwing and rejecting observers cannot prevent transaction confirmation or later observers', async () => {
  const bus = new LittlePubSub(), errors = [], received = []
  bus.subscribe('block-processed', () => { throw new Error('UI failed') })
  bus.subscribe('block-processed', async () => { throw new Error('async UI failed') })
  const wait = waitForCanonicalTransaction(bus, { delete: async () => {} }, 'tx')
  bus.subscribe('block-processed', value => received.push(value))
  publishObserverEvent(bus, 'block-processed', { index: 1n, transactions: ['tx'] }, (topic, error) => errors.push([topic, error.message]))
  assert.equal(await wait, 'tx')
  assert.equal(received.length, 1)
  assert.deepEqual(errors, [['block-processed', 'UI failed'], ['block-processed', 'async UI failed']])
})

test('once and self-unsubscribing observers do not skip later subscribers', async () => {
  const bus = new LittlePubSub(), received = [], errors = []
  const once = bus.once('event')
  const remove = bus.subscribe('event', () => { received.push('remove'); remove() })
  bus.subscribe('event', () => received.push('last'))
  publishObserverEvent(bus, 'event', 1, (_, error) => errors.push(error))
  assert.equal(await once, 1)
  assert.deepEqual(received, ['remove', 'last'])
  assert.equal(bus.getValue('event'), 1)
  assert.equal(bus.subscriberCount('event'), 1)
  assert.deepEqual(errors, [])
})

test('notification payloads cannot mutate the canonical object or byte buffer', () => {
  const bus = new LittlePubSub()
  const header = { transactions: ['tx'], validators: [{ address: 'validator' }] }
  const bytes = Uint8Array.of(1, 2)
  bus.subscribe('block', value => { value.transactions.pop(); value.validators[0].address = 'other' })
  bus.subscribe('bytes', value => { value[0] = 255 })
  publishObserverEvent(bus, 'block', header)
  publishObserverEvent(bus, 'bytes', bytes)
  assert.deepEqual(header, { transactions: ['tx'], validators: [{ address: 'validator' }] })
  assert.deepEqual(bytes, Uint8Array.of(1, 2))
})

test('a cached notification, bound context and primitive change detection keep bus semantics', () => {
  const bus = new LittlePubSub(), context = { values: [] }
  publishObserverEvent(bus, 'event', 1)
  bus.subscribe('event', function (value, old) { this.values.push([value, old]) }, { context })
  publishObserverEvent(bus, 'event', 1)
  publishObserverEvent(bus, 'event', 2)
  assert.deepEqual(context.values, [[1, undefined], [2, 1]])
})

test('custom bus and diagnostic failures cannot escape notification dispatch', () => {
  const bus = { publish() { throw new Error('custom bus failed') } }
  assert.doesNotThrow(() => publishObserverEvent(bus, 'event', 1, () => { throw new Error('logger failed') }))
})

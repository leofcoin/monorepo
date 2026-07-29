import assert from 'node:assert/strict'
import test from 'node:test'

import SyncController from '../src/sync-controller.ts'

test('concurrent sync operations keep independent retry budgets', async () => {
  const controller = new SyncController()
  let firstAttempts = 0
  let secondAttempts = 0

  const first = controller.resolve(async () => {
    firstAttempts += 1
    if (firstAttempts < 3) throw new Error('first transient failure')
    return 'first'
  }, 100)

  const second = controller.resolve(async () => {
    secondAttempts += 1
    if (secondAttempts < 2) throw new Error('second transient failure')
    return 'second'
  }, 100)

  assert.deepEqual(await Promise.all([first, second]), ['first', 'second'])
  assert.equal(firstAttempts, 3)
  assert.equal(secondAttempts, 2)
})

test('timed-out attempts do not overwrite a successful retry', async () => {
  const controller = new SyncController()
  let attempts = 0

  const result = await controller.resolve(async () => {
    attempts += 1
    if (attempts === 1) {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return 'late result'
    }
    return 'retry result'
  }, 10)

  assert.equal(result, 'retry result')
  assert.equal(attempts, 2)
})

test('stop rejects active operations without retrying them', async () => {
  const controller = new SyncController()
  let attempts = 0
  const pending = controller.resolve(
    () => {
      attempts += 1
      return new Promise(() => {})
    },
    1_000
  )

  await new Promise((resolve) => setImmediate(resolve))
  controller.stop()

  await assert.rejects(pending, /Operation stopped/)
  assert.equal(attempts, 1)
})

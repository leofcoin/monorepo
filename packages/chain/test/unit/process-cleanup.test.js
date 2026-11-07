import assert from 'node:assert/strict'
import test from 'node:test'
import { settleProcesses } from '../../../../test/helpers/settle-processes.js'

test('failed process does not allow cleanup before its sibling has finished', async () => {
  let finish
  const events = []
  const sibling = new Promise(resolve => { finish = () => { events.push('sibling-exited'); resolve() } })
  const done = settleProcesses([Promise.reject(new Error('first failed')), sibling])
    .catch(error => { events.push('cleanup'); return error })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events, [])
  finish()
  const error = await done
  assert(error instanceof AggregateError)
  assert.match(error.cause.message, /first failed/)
  assert.deepEqual(events, ['sibling-exited', 'cleanup'])
})

test('process settlement retains successes and all failure diagnostics', async () => {
  assert.deepEqual(await settleProcesses([Promise.resolve(1), Promise.resolve(2)]), [1, 2])
  await assert.rejects(settleProcesses([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]), error => {
    assert.deepEqual(error.errors.map(value => value.message), ['a', 'b'])
    return true
  })
})

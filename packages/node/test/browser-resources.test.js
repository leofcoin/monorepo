import test from 'node:test'
import assert from 'node:assert/strict'
import { browserResources, measureBrowserMemory } from '../src/controllers/browser-resources.js'

test('resource hints expose processor availability, never pretend to be system CPU or RAM usage', () => {
  assert.deepEqual(browserResources({ navigator: { hardwareConcurrency: 8 }, performance: {}, isolated: true }), {
    threads: 8, memoryReason: 'This browser does not expose application memory measurements.'
  })
  for (const hardwareConcurrency of [undefined, 0, -1, 2.5, Infinity, '8']) {
    assert.equal(browserResources({ navigator: { hardwareConcurrency }, isolated: false }).threads, null)
  }
})

test('memory measurement fails closed without isolation and does not read legacy heap counters', async () => {
  const performance = { get memory() { throw new Error('legacy API read') }, measureUserAgentSpecificMemory() { throw new Error('must not run') } }
  await assert.rejects(measureBrowserMemory({ performance, isolated: false }), /cross-origin-isolated/)
  await assert.rejects(measureBrowserMemory({ performance: {}, isolated: true }), /does not expose/)
})

test('memory samples validate bytes and propagate denied access without inventing zero usage', async () => {
  const options = bytes => ({ performance: { measureUserAgentSpecificMemory: async () => ({ bytes }) }, isolated: true })
  assert.equal(await measureBrowserMemory(options(123456)), 123456)
  assert.equal(await measureBrowserMemory(options(0)), 0)
  for (const bytes of [undefined, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '512']) {
    await assert.rejects(measureBrowserMemory(options(bytes)), /invalid memory/)
  }
  await assert.rejects(measureBrowserMemory({ performance: { measureUserAgentSpecificMemory: async () => { throw new Error('denied') } }, isolated: true }), /denied/)
})

test('timed-out samples are reused on retry instead of scheduling overlapping measurements', async () => {
  let finish, calls = 0
  const performance = { measureUserAgentSpecificMemory: () => { calls++; return new Promise(resolve => { finish = resolve }) } }
  await assert.rejects(measureBrowserMemory({ performance, isolated: true, timeoutMs: 5 }), /timed out/)
  const retry = measureBrowserMemory({ performance, isolated: true })
  finish({ bytes: 42 })
  assert.equal(await retry, 42)
  assert.equal(calls, 1)
})

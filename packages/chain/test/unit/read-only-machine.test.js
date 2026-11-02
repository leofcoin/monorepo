import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { jsonStringifyBigInt } from '@leofcoin/utils'

// Exercise the production queue/cache/lifecycle without native processes or ports.
const source = readFileSync(new URL('../../src/read-only-machine.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const create = (reply = input => ({ method: input.method, params: input.params })) => {
  const workers = [], requests = []
  class Worker {
    stopped = false
    worker = {}
    constructor() { workers.push(this) }
    onmessage(handler) { this.handler = handler }
    onerror(handler) { this.error = handler }
    terminate() { this.stopped = true }
    postMessage(message) {
      requests.push(message)
      if (message.type === 'read' && message.input.method === 'stall') return
      queueMicrotask(() => this.handler({ type: 'response', id: message.id,
        value: message.type === 'init' ? true : reply(message.input) }))
    }
  }
  const exports = {}
  new Function('EasyWorker', 'jsonStringifyBigInt', 'exports', code)(Worker, jsonStringifyBigInt, exports)
  const reader = new exports.ReadOnlyMachine('fixture-worker', async () => Uint8Array.of(1))
  return { reader, workers, requests }
}
const seed = () => ({ lastBlock: { index: 0, hash: 'tip' }, states: {}, info: {} })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('isolated read results are cached, cloned, bounded to 64 entries and invalidated at a new committed snapshot', async t => {
  const { reader, requests, workers } = create()
  t.after(() => reader.close())
  const first = seed()
  const value = await reader.read(first, 'contract', 'state', [1n])
  value.params[0] = 999n
  assert.deepEqual((await reader.read(first, 'contract', 'state', [1n])).params, [1n])
  assert.equal(requests.filter(item => item.type === 'read').length, 1)
  for (let index = 0; index < 64; index++) await reader.read(first, 'contract', 'value', [index])
  const count = requests.length
  await reader.read(first, 'contract', 'state', [1n])
  assert.equal(requests.length, count + 2, 'the evicted result is reinitialized and queried')
  await reader.read(seed(), 'contract', 'state', [1n])
  assert.equal(requests.length, count + 4, 'a new snapshot invalidates cached results')
  assert.equal(workers.length, 1, 'normal queries reuse one worker')
})

test('read query admission bounds input and the queue; shutdown rejects queued work and releases the worker', async () => {
  const { reader, workers, requests } = create()
  const snapshot = seed()
  await assert.rejects(reader.read(snapshot, 'contract', 'constructor'), /Invalid read-only/)
  await assert.rejects(reader.read(snapshot, 'contract', 'state', ['x'.repeat(65536)]), /too large/)
  const pending = Array.from({ length: 32 }, () => reader.read(snapshot, 'contract', 'stall'))
  const settled = Promise.allSettled(pending)
  await assert.rejects(reader.read(snapshot, 'contract', 'state'), /queue is full/)
  while (!requests.some(item => item.type === 'read')) await tick()
  reader.close()
  assert.ok((await settled).every(result => result.status === 'rejected'))
  assert.equal(workers[0].stopped, true)
  await assert.rejects(reader.read(snapshot, 'contract', 'state'), /closed/)
})

test('a timed-out read kills only its query worker and a later query can create a replacement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { reader, requests, workers } = create()
  t.after(() => reader.close())
  const pending = reader.read(seed(), 'contract', 'stall')
  const rejected = assert.rejects(pending, /timed out/)
  while (!requests.some(item => item.type === 'read')) await tick()
  t.mock.timers.tick(10001)
  await rejected
  assert.equal(workers[0].stopped, true)
  await reader.read(seed(), 'contract', 'state')
  assert.equal(workers.length, 2)
})

test('oversized read results are rejected without poisoning future query work', async t => {
  const { reader, workers } = create(input => input.method === 'huge' ? 'x'.repeat(4 * 1024 * 1024 + 1) : 1n)
  t.after(() => reader.close())
  await assert.rejects(reader.read(seed(), 'contract', 'huge'), /result is too large/)
  assert.equal(workers[0].stopped, true)
  assert.equal(await reader.read(seed(), 'contract', 'value'), 1n)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import BinaryWorker from '../exports/binary-worker.js'

test('real process IPC uses Uint8Array in both directions and retains exact values', async t => {
  const worker = await new BinaryWorker(fileURLToPath(new URL('../fixtures/binary-child.js', import.meta.url)))
  t.after(() => worker.terminate())
  let rawIsBytes = false
  worker.worker.on('message', bytes => { rawIsBytes = bytes instanceof Uint8Array })
  const value = { amount: 2n ** 150n, params: [new Uint8Array([0, 255]), { enabled: false }] }
  const result = await worker.once(value)
  assert.equal(rawIsBytes, true)
  assert.equal(result.rawIsBytes, true)
  assert.deepEqual(result.value, value)
})

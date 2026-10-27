import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { readEvents } from './events.js'

test('reads fragmented events larger than a stdout chunk exactly once', () => {
  const stream = new PassThrough()
  const events = []
  const reader = readEvents(stream, event => events.push(event))
  const event = { type: 'status', blockHashes: Array.from({ length: 2000 }, (_, i) => `${i}`.padEnd(60, 'A')) }
  const line = `E2E_EVENT:${JSON.stringify(event)}\n`
  stream.write(line.slice(0, 5))
  stream.write(line.slice(5, 65_536))
  assert.deepEqual(events, [])
  stream.write(line.slice(65_536))
  assert.deepEqual(events, [event])
  stream.end()
  reader.close()
})

test('reads coalesced events while ignoring ordinary diagnostic lines', () => {
  const stream = new PassThrough()
  const events = []
  const reader = readEvents(stream, event => events.push(event))
  stream.end('node diagnostic\nE2E_EVENT:{"type":"ready"}\nE2E_EVENT:{"type":"status"}\n')
  assert.deepEqual(events, [{ type: 'ready' }, { type: 'status' }])
  reader.close()
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { startRecoveryTransport, requestRecoveryContent } from '../../exports/recovery-transport.js'

const turn = () => new Promise(resolve => setImmediate(resolve))
const connection = () => ({ connected: true, request() {} })

test('recovery and explicit autostart share one in-flight transport startup', async () => {
  let release, calls = 0
  const gate = new Promise(resolve => { release = resolve })
  const peer = { start: async () => { calls++; await gate } }
  const first = startRecoveryTransport(peer), second = startRecoveryTransport(peer)
  assert.equal(first, second)
  await turn()
  assert.equal(calls, 1)
  release()
  await Promise.all([first, second])
  await startRecoveryTransport(peer)
  assert.equal(calls, 1)
})

test('failed transport startup rejects explicitly and can be retried', async () => {
  let calls = 0
  const peer = { start: async () => { if (++calls === 1) throw new Error('fixture transport failure') } }
  await assert.rejects(startRecoveryTransport(peer), /fixture transport failure/)
  await startRecoveryTransport(peer)
  assert.equal(calls, 2)
})

test('a missing body waits for a late provider instead of rejecting Promise.any([])', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const peer = { id: 'self', stars: ['fixture-star'], connections: {}, start: async () => { calls++ } }
  let settled = false
  const result = requestRecoveryContent(peer, async id => id).then(value => { settled = true; return value })
  await turn()
  assert.equal(calls, 1)
  assert.equal(settled, false)
  peer.connections.provider = connection()
  t.mock.timers.tick(100)
  assert.equal(await result, 'provider')
})

test('negative early peers are not repeatedly queried and cannot hide a later provider', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const queried = []
  const peer = { id: 'self', stars: ['fixture-star'], connections: { empty: connection() }, start: async () => {} }
  const result = requestRecoveryContent(peer, async id => {
    queried.push(id)
    if (id === 'empty') throw new Error('content absent')
    return Uint8Array.of(1, 2, 3)
  })
  await turn()
  t.mock.timers.tick(500)
  await turn()
  assert.deepEqual(queried, ['empty'])
  peer.connections.provider = connection()
  t.mock.timers.tick(100)
  assert.deepEqual(await result, Uint8Array.of(1, 2, 3))
  assert.deepEqual(queried, ['empty', 'provider'])
})

test('reconnected peers with a new connection object can provide the missing body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const peer = { id: 'self', stars: ['fixture-star'], connections: { provider: connection() }, start: async () => {} }
  const result = requestRecoveryContent(peer, async () => { if (++calls === 1) throw new Error('stale connection'); return 'body' })
  await turn()
  peer.connections.provider = connection()
  t.mock.timers.tick(100)
  assert.equal(await result, 'body')
  assert.equal(calls, 2)
})

test('the single deadline bounds discovery, stalled startup and stalled content requests', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const scenario of ['no-peers', 'stalled-start', 'stalled-fetch']) {
    const peer = { id: 'self', stars: ['fixture-star'], connections: {},
      start: () => scenario === 'stalled-start' ? new Promise(() => {}) : Promise.resolve() }
    if (scenario === 'stalled-fetch') peer.connections.provider = connection()
    const result = requestRecoveryContent(peer, () => new Promise(() => {}))
    const rejected = assert.rejects(result, /No connected peers|No content provider/)
    await turn()
    t.mock.timers.tick(30000)
    await rejected
  }
})

test('offline roots and synthetic transports without start fail clearly without a discovery wait', async () => {
  for (const peer of [{ connections: {} }, { stars: [], connections: {}, start: async () => {} }]) {
    await assert.rejects(requestRecoveryContent(peer, async () => { throw new Error('must not fetch') }), /No connected peers/)
  }
})

test('self/disconnected/invalid connections are ignored and slow failures cannot beat valid content', async () => {
  const peer = { id: 'self', connections: { self: connection(), offline: { ...connection(), connected: false },
    invalid: { connected: true }, empty: connection(), provider: connection() } }
  const queried = []
  assert.equal(await requestRecoveryContent(peer, async id => {
    queried.push(id)
    if (id === 'empty') throw new Error('no content')
    return 'body'
  }), 'body')
  assert.deepEqual(queried.sort(), ['empty', 'provider'])
})

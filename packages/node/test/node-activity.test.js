import assert from 'node:assert/strict'
import test from 'node:test'
import { NodeActivity } from '../src/controllers/node-activity.js'

const settle = () => new Promise((resolve) => setImmediate(resolve))

test('bounds the activity buffer, retains totals and returns detached snapshots', () => {
  const monitor = new NodeActivity()
  for (let i = 0; i < 350; i++)
    monitor.record({ direction: 'in', transport: 'P2P', operation: 'message', bytes: 2 })
  const snapshot = monitor.snapshot()
  assert.equal(snapshot.events.length, 300)
  assert.equal(snapshot.totals.incoming, 350)
  assert.equal(snapshot.totals.bytesIn, 700)
  snapshot.events[0].operation = 'changed'
  assert.equal(monitor.snapshot().events[0].operation, 'message')
  monitor.clear()
  assert.deepEqual(monitor.snapshot(), {
    events: [], totals: { incoming: 0, outgoing: 0, errors: 0, bytesIn: 0, bytesOut: 0 }
  })
})

test('observes HTTP metadata without consuming responses or retaining URL secrets', async () => {
  const monitor = new NodeActivity()
  const response = new Response('payload', { status: 200 })
  const result = Promise.resolve(response)
  const global = {
    location: { href: 'https://local.test/' },
    fetch(input, options) { assert.equal(this, global); assert.equal(options.token, 'private'); return result }
  }
  const original = global.fetch
  monitor.start(global)
  assert.equal(global.fetch('https://user:password@example.test/private?key=secret', { token: 'private' }), result)
  await settle()
  assert.equal(response.bodyUsed, false)
  assert.equal(monitor.snapshot().totals.incoming, 1)
  assert.equal(monitor.snapshot().totals.outgoing, 1)
  assert.equal(monitor.snapshot().events[0].remote, 'https://example.test')
  assert.doesNotMatch(JSON.stringify(monitor.snapshot()), /password|private|secret|payload/)
  monitor.stop()
  assert.equal(global.fetch, original)
})

test('preserves HTTP rejection and synchronous throw behavior and records failures', async () => {
  const failure = new Error('original failure')
  const monitor = new NodeActivity()
  const global = { fetch: () => Promise.reject(failure) }
  monitor.start(global)
  await assert.rejects(global.fetch('https://example.test/'), (error) => error === failure)
  await settle()
  assert.equal(monitor.snapshot().totals.errors, 1)
  monitor.stop()
  global.fetch = () => { throw failure }
  monitor.start(global)
  assert.throws(() => global.fetch('malformed URL'), (error) => error === failure)
  assert.equal(monitor.snapshot().totals.errors, 2)
  monitor.stop()
})

test('tracks P2P requests and protocol messages, preserves results and cleans replaced peers', async () => {
  const monitor = new NodeActivity()
  const result = Promise.resolve(new Uint8Array(4))
  const request = function () { assert.equal(this, peer); return result }
  const peer = { id: 'peer-a', connected: true, request }
  const handler = function (message) { assert.equal(this, peernet); return message }
  const send = () => Promise.resolve('message-id')
  const peernet = { connections: { 'peer-a': peer }, _protoHandler: handler, sendMessage: send }
  monitor.start({ peernet })
  monitor.refreshPeers()
  assert.equal(peer.request(new Uint8Array(3)), result)
  const message = { proto: { name: 'peernet-ps', encoded: new Uint8Array(5) } }
  assert.equal(peernet._protoHandler(message, peer, peer.id), message)
  await peernet.sendMessage(peer, 'id', new Uint8Array(2))
  await settle()
  const { totals } = monitor.snapshot()
  assert.equal(totals.incoming, 2)
  assert.equal(totals.outgoing, 2)
  assert.equal(totals.bytesIn, 9)
  assert.equal(totals.bytesOut, 5)
  delete peernet.connections['peer-a']
  monitor.refreshPeers()
  assert.equal(peer.request, request)
  monitor.stop()
  assert.equal(peernet._protoHandler, handler)
  assert.equal(peernet.sendMessage, send)
})

test('observes WebSocket messages with native construction and removes all hooks on stop', () => {
  class Socket extends EventTarget {
    static OPEN = 1
    constructor(url) { super(); this.url = url }
    send(data) { this.sent = data }
  }
  const monitor = new NodeActivity()
  const send = Socket.prototype.send
  const global = { WebSocket: Socket }
  monitor.start(global)
  assert.equal(global.WebSocket.OPEN, 1)
  const socket = new global.WebSocket('wss://endpoint.test/path?token=secret')
  assert.ok(socket instanceof Socket)
  socket.send('hi')
  socket.dispatchEvent(new MessageEvent('message', { data: 'hello' }))
  assert.equal(monitor.snapshot().totals.bytesIn, 5)
  assert.equal(monitor.snapshot().totals.bytesOut, 2)
  assert.doesNotMatch(JSON.stringify(monitor.snapshot()), /secret|token|hello/)
  monitor.stop()
  assert.equal(global.WebSocket, Socket)
  assert.equal(Socket.prototype.send, send)
  socket.dispatchEvent(new MessageEvent('message', { data: 'ignored' }))
  assert.equal(monitor.snapshot().totals.incoming, 1)
})

test('stops observing pending requests and records original WebSocket send failures', async () => {
  let resolve
  const monitor = new NodeActivity()
  const pending = new Promise((accept) => { resolve = accept })
  const global = { fetch: () => pending }
  monitor.start(global)
  const result = global.fetch('https://example.test/')
  monitor.stop()
  resolve(new Response('not observed'))
  await result
  await settle()
  assert.equal(monitor.snapshot().totals.incoming, 0)
  const failure = new Error('socket closed')
  class Socket extends EventTarget {
    constructor(url) { super(); this.url = url }
    send() { throw failure }
  }
  global.WebSocket = Socket
  monitor.start(global)
  const socket = new global.WebSocket('wss://example.test/')
  assert.throws(() => socket.send('test'), (error) => error === failure)
  assert.equal(monitor.snapshot().totals.errors, 1)
  monitor.stop()
})

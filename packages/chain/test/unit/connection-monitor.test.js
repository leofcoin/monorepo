import test from 'node:test'
import assert from 'node:assert/strict'
import { guardPeerMessages, isSendablePeer } from '../../exports/connection-monitor.js'

test('accepts connected and negotiating peer transports', () => {
  const negotiatingPeer = {
    connected: false,
    send() {},
    once() {},
    removeListener() {}
  }

  assert.equal(isSendablePeer(negotiatingPeer), true)
  assert.equal(isSendablePeer({ connected: true, send() {} }), true)
})

test('rejects restored connection placeholders without event methods', () => {
  assert.equal(isSendablePeer({ connected: false, send() {} }), false)
  assert.equal(isSendablePeer({ connected: true }), false)
  assert.equal(isSendablePeer(undefined), false)
})

test('drops malformed peers at the send boundary', async () => {
  const invalidPeer = { connected: false, send() {} }
  let delegated = false
  const peernet = {
    connections: { invalid: invalidPeer },
    sendMessage() {
      delegated = true
    }
  }

  guardPeerMessages(peernet)
  await peernet.sendMessage(invalidPeer, 'message-id', new Uint8Array())

  assert.equal(delegated, false)
  assert.deepEqual(peernet.connections, {})
})

test('delegates valid peers at the send boundary', async () => {
  const validPeer = { connected: true, send() {} }
  let delegatedPeer
  const peernet = {
    connections: { valid: validPeer },
    sendMessage(peer) {
      delegatedPeer = peer
      return Promise.resolve('message-id')
    }
  }

  guardPeerMessages(peernet)
  const result = await peernet.sendMessage(validPeer, 'message-id', new Uint8Array())

  assert.equal(result, 'message-id')
  assert.equal(delegatedPeer, validPeer)
})

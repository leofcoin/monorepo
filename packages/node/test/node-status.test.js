import assert from 'node:assert/strict'
import test from 'node:test'
import { blockHeight, nodeStatus } from '../src/controllers/node-status.js'

const connected = { started: true, version: '0.4.0', sync: 'synced', local: 0n, target: 0, start: -1,
  connections: { peer: { connected: true, version: '0.4.9' } } }

test('block zero is a real height; encoded, missing and unsafe heights are unknown', () => {
  assert.equal(blockHeight(0n), 0)
  assert.equal(blockHeight(-1), -1)
  for (const value of [null, undefined, '', '0', NaN, Infinity, -2, 1.5, 2n ** 64n, new Uint8Array([0])]) {
    assert.equal(blockHeight(value), null)
  }
  const status = nodeStatus(connected)
  assert.equal(status.target, 0)
  assert.equal(status.local, 0)
  assert.equal(status.progress, 100)
  assert.equal(status.ready, true)
})

test('startup, connection, compatibility and sync are distinct conditions', () => {
  assert.equal(nodeStatus({}).state, 'locked')
  assert.equal(nodeStatus({ started: true }).state, 'offline')
  assert.equal(nodeStatus({ ...connected, error: 'Startup failed' }).state, 'error')
  assert.equal(nodeStatus({ ...connected, sync: 'syncing' }).ready, false)
  assert.equal(nodeStatus({ ...connected, sync: 'errored' }).state, 'error')
  assert.equal(nodeStatus({ ...connected, local: null }).ready, false)
  assert.equal(nodeStatus({ ...connected, connections: {} }).ready, false)
  assert.equal(nodeStatus({ ...connected, connections: { peer: { connected: false, version: '0.4.0' } } }).peers.length, 0)
  const unknown = nodeStatus({ ...connected, connections: { peer: { connected: true } } })
  assert.equal(unknown.ready, false)
  assert.equal(unknown.negotiating, 1)
  assert.match(unknown.label, /versions/)
  for (const version of ['0.3.0', '1.4.0', 'undefined', '0.4', null]) {
    assert.equal(nodeStatus({ ...connected, connections: { peer: { connected: true, version } } }).compatible, 0)
  }
})

test('catch-up is bounded and unknown targets do not become fictitious progress', () => {
  assert.equal(nodeStatus({ ...connected, sync: 'syncing', local: 50, start: 0, target: 100 }).progress, 50)
  assert.equal(nodeStatus({ ...connected, local: 50, start: 0, target: 100 }).ready, false)
  assert.equal(nodeStatus({ ...connected, sync: 'syncing', local: -1, start: 0, target: 100 }).progress, 0)
  assert.equal(nodeStatus({ ...connected, sync: 'syncing', local: 150, start: 0, target: 100 }).progress, 100)
  assert.equal(nodeStatus({ ...connected, sync: 'syncing', target: null }).progress, null)
  assert.equal(nodeStatus({ ...connected, sync: 'syncing', local: -1, target: 0, start: -1 }).progress, 0)
  assert.equal(nodeStatus({ ...connected, version: undefined }).ready, false)
})

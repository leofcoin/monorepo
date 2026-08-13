import assert from 'node:assert/strict'
import test from 'node:test'

import { bls12_381 as bls } from '@noble/curves/bls12-381'
import { toBase58 } from '@vandeurenglenn/typed-array-utils'

import {
  BeaconLifecycle,
  clearBeaconEpochStorage,
  loadPrivateBeaconEpoch,
  loadPublicBeaconEpoch,
  persistPrivateBeaconEpoch,
  persistPublicBeaconEpoch,
  restoreBeaconLifecycle
} from '../../src/consensus/beacon-lifecycle.ts'
import { beaconEpochDigest } from '../../src/consensus/beacon-epoch.ts'

class MemoryStore {
  data = new Map()
  async put(key, value) {
    this.data.set(key, value)
  }
  async get(key) {
    return this.data.get(key)
  }
  async has(key) {
    return this.data.has(key)
  }
  async keys() {
    return [...this.data.keys()]
  }
  async delete(key) {
    return this.data.delete(key)
  }
}

const validators = ['a', 'b', 'c', 'd']
const config = (epoch) => ({
  epoch,
  threshold: 3,
  validators,
  dealers: validators.map((validator, index) => ({
    validator,
    commitments: [2, 3, 5].map((offset) => toBase58(bls.getPublicKey(BigInt(index * 10 + offset))))
  }))
})
const active = (epoch) => {
  const value = config(epoch)
  const configDigest = beaconEpochDigest(value)
  return {
    config: value,
    certificate: validators.slice(0, 3).map((from) => ({ epoch, configDigest, from, signature: `sig-${from}` }))
  }
}
const signer = (tag) => async (input) => {
  const output = new Uint8Array(64).fill(tag)
  output.set(input.subarray(0, 16), 0)
  return output
}

test('starts ceremonies one epoch ahead and retains the active key after a failed successor', () => {
  const lifecycle = new BeaconLifecycle(10)
  assert.equal(lifecycle.ceremonyEpoch(4), 1n)
  lifecycle.stage(active(1n))
  assert.equal(lifecycle.advance(9), undefined)
  assert.equal(lifecycle.advance(10).config.epoch, 1n)
  assert.equal(lifecycle.advance(20).config.epoch, 1n)
  lifecycle.stage(active(3n))
  assert.equal(lifecycle.advance(30).config.epoch, 3n)
})

test('persists public certificates and identity-sealed private shares across restart', async () => {
  const publicStore = new MemoryStore()
  const privateStore = new MemoryStore()
  await persistPublicBeaconEpoch(publicStore, 'leofcoin', active(2n))
  await persistPrivateBeaconEpoch(
    privateStore,
    'leofcoin',
    'validator-a',
    { epoch: 2n, secretShare: '123', encryptionPrivateKey: '456' },
    signer(7),
    () => new Uint8Array(12).fill(9)
  )
  assert.equal((await loadPublicBeaconEpoch(publicStore, 'leofcoin', 2n)).config.epoch, 2n)
  assert.deepEqual(await loadPrivateBeaconEpoch(privateStore, 'leofcoin', 'validator-a', 2n, signer(7)), {
    epoch: 2n,
    secretShare: '123',
    encryptionPrivateKey: '456'
  })
  await assert.rejects(() => loadPrivateBeaconEpoch(privateStore, 'leofcoin', 'validator-b', 2n, signer(8)))
})

test('does not count duplicate or foreign certificate voters toward threshold', async () => {
  const store = new MemoryStore()
  const invalid = active(2n)
  invalid.certificate = [invalid.certificate[0], invalid.certificate[0], invalid.certificate[1]]
  await assert.rejects(() => persistPublicBeaconEpoch(store, 'leofcoin', invalid), /certificate/)
  const foreign = active(2n)
  foreign.certificate[2] = { ...foreign.certificate[2], from: 'foreign' }
  await assert.rejects(() => persistPublicBeaconEpoch(store, 'leofcoin', foreign), /certificate/)
})

test('fresh genesis removes only network-scoped beacon records', async () => {
  const store = new MemoryStore()
  await store.put('beacon/private/leofcoin/1', new Uint8Array([1]))
  await store.put('beacon/public/leofcoin/1', new Uint8Array([1]))
  await store.put('beacon/private/other/1', new Uint8Array([1]))
  await store.put('identity', new Uint8Array([1]))
  await clearBeaconEpochStorage([store], 'leofcoin')
  assert.deepEqual(await store.keys(), ['beacon/private/other/1', 'identity'])
})

test('restores the newest certified epoch at or below the canonical height', async () => {
  const publicStore = new MemoryStore()
  const privateStore = new MemoryStore()
  await persistPublicBeaconEpoch(publicStore, 'leofcoin', active(1n))
  await persistPublicBeaconEpoch(publicStore, 'leofcoin', active(3n))
  await persistPrivateBeaconEpoch(
    privateStore,
    'leofcoin',
    'validator-a',
    { epoch: 1n, secretShare: '123', encryptionPrivateKey: '456' },
    signer(7),
    () => new Uint8Array(12).fill(9)
  )
  const restored = await restoreBeaconLifecycle(publicStore, privateStore, 'leofcoin', 'validator-a', 25, 10, signer(7))
  assert.equal(restored.lifecycle.active.config.epoch, 1n)
  assert.equal(restored.privateEpoch.epoch, 1n)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { acquireBrowserStorageLease, browserStorageOverview, completePendingStorageMaintenance,
  scheduleStorageMaintenance, storageOperation, STORAGE_DIRTY_KEY, STORAGE_LOCK, STORAGE_REQUEST_KEY } from '../src/controllers/browser-storage.js'

function storage() {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
const locks = { request: async (_key, _options, callback) => callback({}) }
const request = (action = 'chain', networkKey = 'peach') => JSON.stringify({ version: 1, action, networkKey })
function fixture(action = 'chain', networkKey = 'peach') {
  const session = storage(), persistent = storage(), opened = [], cleared = []
  session.setItem(STORAGE_REQUEST_KEY, request(action, networkKey))
  const records = new Map([
    ['wallet', new Map([['identity', Uint8Array.of(1)], ['beacon/private/leofcoin:peach/1', Uint8Array.of(2)],
      ['beacon/public/leofcoin:peach/1', Uint8Array.of(3)], ['beacon/private/leofcoin:mainnet/1', Uint8Array.of(4)]])],
    ['block-mainnet', new Map([['keep', Uint8Array.of(7)]])],
    ['account-peach', new Map([['public', Uint8Array.of(9)]])]
  ])
  class FakeStorage {
    constructor(name) { this.name = name; if (!records.has(name)) records.set(name, new Map([['old', Uint8Array.of(5)]])); this.records = records.get(name) }
    async init() { opened.push(this.name) }
    async clear() { assert(persistent.getItem(STORAGE_DIRTY_KEY)); cleared.push(this.name); this.records.clear() }
    async keys() { return [...this.records.keys()] }
    async entries() { return [...this.records] }
    async delete(key) { this.records.delete(key) }
  }
  return { session, persistent, records, opened, cleared, FakeStorage,
    options: { storage: session, persistentStorage: persistent, locks, StorageClass: FakeStorage } }
}

test('storage management only exposes whitelisted network-scoped actions and schedules a reload', () => {
  assert.throws(() => storageOperation('wallet', 'peach'), /Unsupported storage operation/)
  assert.throws(() => storageOperation('chain', '__proto__'), /Unsupported storage network/)
  const session = storage(); let reloads = 0
  scheduleStorageMaintenance({ action: 'pool', networkKey: 'mainnet', storage: session, location: { reload() { reloads++ } } })
  assert.equal(reloads, 1)
  assert.equal(session.getItem(STORAGE_REQUEST_KEY), request('pool', 'mainnet'))
})

test('scheduling cannot replace an incomplete clear and restores its marker if reload fails', () => {
  const session = storage(), persistent = storage()
  persistent.setItem(STORAGE_DIRTY_KEY, request())
  assert.throws(() => scheduleStorageMaintenance({ action: 'pool', networkKey: 'mainnet', storage: session,
    persistentStorage: persistent, location: { reload() { throw new Error('must not reload') } } }), /Another storage operation/)
  assert.equal(session.getItem(STORAGE_REQUEST_KEY), null)
  persistent.removeItem(STORAGE_DIRTY_KEY)
  assert.throws(() => scheduleStorageMaintenance({ action: 'pool', networkKey: 'peach', storage: session,
    persistentStorage: persistent, location: { reload() { throw new Error('reload failed') } } }), /reload failed/)
  assert.equal(session.getItem(STORAGE_REQUEST_KEY), null)
})

test('chain removal clears matching ledger stores while retaining identity, accounts and other-network beacon shares', async () => {
  const f = fixture()
  assert.equal(await completePendingStorageMaintenance(f.options), true)
  assert.deepEqual(f.cleared.sort(), storageOperation('chain', 'peach').stores.sort())
  assert.deepEqual([...f.records.get('wallet').keys()].sort(), ['beacon/private/leofcoin:mainnet/1', 'identity'])
  assert.equal(f.records.get('block-mainnet').size, 1)
  assert.equal(f.records.get('account-peach').size, 1)
  assert.equal(f.session.getItem(STORAGE_REQUEST_KEY), null)
  assert.equal(f.persistent.getItem(STORAGE_DIRTY_KEY), null)
})

test('pending-pool removal opens only that pool, never the wallet or canonical state', async () => {
  const f = fixture('pool', 'mainnet')
  await completePendingStorageMaintenance(f.options)
  assert.deepEqual(f.opened, ['transactionPool-mainnet'])
  assert.equal(f.records.get('wallet').size, 4)
  assert.equal(f.records.get('block-mainnet').size, 1)
})

test('an active writer or unsupported lock API prevents every store open and clear', async () => {
  for (const manager of [null, { request: async (_key, _options, callback) => callback(null) }]) {
    const f = fixture()
    await assert.rejects(completePendingStorageMaintenance({ ...f.options, locks: manager }), /operation incomplete/)
    assert.deepEqual(f.opened, [])
    assert.deepEqual(f.cleared, [])
    assert.equal(f.persistent.getItem(STORAGE_DIRTY_KEY), null)
  }
})

test('failed multi-store clears settle before releasing the lock and retain an origin-wide retry journal', async () => {
  const f = fixture()
  let release, pending = false, settled = false
  class FailingStorage extends f.FakeStorage {
    async clear() {
      if (this.name === 'block-peach') { pending = true; await new Promise(resolve => { release = resolve }) }
      if (this.name === 'state-peach') throw new Error('disk failure')
      return super.clear()
    }
  }
  const operation = completePendingStorageMaintenance({ ...f.options, StorageClass: FailingStorage })
    .catch(error => { settled = true; return error })
  while (!pending) await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false)
  release()
  assert.match((await operation).message, /disk failure/)
  assert.equal(f.persistent.getItem(STORAGE_DIRTY_KEY), request())
  await assert.rejects(acquireBrowserStorageLease(f.options), /incomplete/)
  const otherContext = await import('../src/controllers/browser-storage.js?other-tab')
  await assert.rejects(otherContext.acquireBrowserStorageLease(f.options), /incomplete/)
  f.session.removeItem(STORAGE_REQUEST_KEY) // The initiating tab may have been closed.
  await completePendingStorageMaintenance(f.options)
  assert.equal(f.persistent.getItem(STORAGE_DIRTY_KEY), null)
})

test('record-supplied store names and conflicting requests cannot target identity or another operation', async () => {
  const f = fixture('pool')
  f.session.setItem(STORAGE_REQUEST_KEY, JSON.stringify({ version: 1, action: 'pool', networkKey: 'peach', stores: ['wallet'] }))
  await completePendingStorageMaintenance(f.options)
  assert.deepEqual(f.opened, ['transactionPool-peach'])
  f.session.setItem(STORAGE_REQUEST_KEY, request('pool', 'mainnet'))
  f.persistent.setItem(STORAGE_DIRTY_KEY, request('chain', 'peach'))
  await assert.rejects(completePendingStorageMaintenance(f.options), /Conflicting storage requests/)
})

test('storage overview is bounded, reads no wallet values and never creates store directories', async () => {
  const requested = []
  const overview = await browserStorageOverview({ networkKey: 'peach', limit: 2, navigator: { storage: {
    estimate: async () => ({ usage: 123, quota: 1000 }), getDirectory: async () => ({
      getDirectoryHandle: async (name, options) => {
        requested.push(name); assert.equal(options.create, false)
        if (name !== 'block-peach') throw new DOMException('missing', 'NotFoundError')
        return { async *keys() { yield 'a'; yield 'b'; throw new Error('scan must stop at bound') } }
      }
    })
  } } })
  assert.equal(overview.usage, 123)
  assert.deepEqual(overview.stores.find(store => store.name === 'block-peach'), { name: 'block-peach', count: 2, truncated: true })
  assert.equal(requested.some(name => name.includes('wallet') || name.includes('mainnet')), false)
})

test('a document-held node lease blocks exclusive maintenance before any stores are touched', async () => {
  const f = fixture('pool')
  await completePendingStorageMaintenance(f.options) // Clear any prior failure state.
  let writer = false
  const manager = { request: async (name, options, callback) => {
    assert.equal(name, STORAGE_LOCK)
    if (options.mode === 'shared') { writer = true; return callback({}) }
    return callback(writer ? null : {})
  } }
  assert.equal(await acquireBrowserStorageLease({ locks: manager, storage: f.session, persistentStorage: f.persistent }), true)
  const next = fixture()
  await assert.rejects(completePendingStorageMaintenance({ ...next.options, locks: manager }), /Close the other Leofcoin/)
  assert.deepEqual(next.opened, [])
})

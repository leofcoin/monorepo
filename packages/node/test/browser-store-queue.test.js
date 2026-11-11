import assert from 'node:assert/strict'
import test from 'node:test'
import Storage from '@leofcoin/storage'
import { installNetworkStoreScope } from '../src/network-selection.js'

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
let BrowserStore
try {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { storage: { getDirectory: async () => ({}) } }
  })
  ;({ default: BrowserStore } = await import(new URL('./browser-store.js', import.meta.resolve('@leofcoin/storage'))))
} finally {
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
  else delete globalThis.navigator
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const turn = () => new Promise(resolve => setImmediate(resolve))

async function fixture(serialized = true) {
  const records = new Map([['tx', { bytes: Uint8Array.of(1), revision: 0 }]])
  const readStarted = deferred(), writeStarted = deferred()
  const state = { readGate: undefined, writeGate: undefined, error: undefined, writing: false }
  const handle = key => ({
    async getFile() {
      const record = records.get(key)
      if (!record) throw new DOMException('Record removed', 'NotFoundError')
      return {
        size: record.bytes.length,
        async arrayBuffer() {
          readStarted.resolve()
          await state.readGate?.promise
          if (state.error) throw state.error
          if (records.get(key)?.revision !== record.revision)
            throw new DOMException('File changed after snapshot', 'NotReadableError')
          return record.bytes.slice().buffer
        }
      }
    },
    async createWritable() {
      state.writing = true
      writeStarted.resolve()
      let bytes
      return {
        async write(value) { bytes = new Uint8Array(value) },
        async close() {
          await state.writeGate?.promise
          records.set(key, { bytes, revision: (records.get(key)?.revision ?? 0) + 1 })
          state.writing = false
        }
      }
    }
  })
  const backend = new BrowserStore()
  backend.db = {
    async getFileHandle(key, options) {
      if (!options?.create && !records.has(key)) throw new DOMException('Missing record', 'NotFoundError')
      return handle(key)
    },
    async removeEntry(key) { records.delete(key) },
    async *keys() { yield* records.keys() },
    async *values() {
      for (const key of records.keys()) yield handle(key)
      if (state.writing) throw new DOMException('Temporary write file is locked', 'NotReadableError')
    },
    async *entries() { for (const key of records.keys()) yield [key, handle(key)] }
  }
  const store = new Storage('transactionPool-peach')
  store.db = backend
  const scope = {
    Peernet: class {
      stores = []
      async addStore(name) { scope[`${name}Store`] = store; this.stores.push(name) }
    }
  }
  let node
  if (serialized) {
    installNetworkStoreScope('peach', scope)
    node = new scope.Peernet()
    await node.addStore('transactionPool', 'lfc', '.leofcoin/peach', false)
  }
  return { store, node, scope, state, readStarted, writeStarted }
}

test('the real OPFS backend reproduces NotReadableError when a bulk snapshot overlaps a write', async () => {
  const f = await fixture(false)
  f.state.readGate = deferred()
  const scan = f.store.values()
  const failure = assert.rejects(scan, { name: 'NotReadableError' })
  await f.readStarted.promise
  await f.store.put('tx', Uint8Array.of(2))
  f.state.readGate.resolve()
  await failure
})

test('network-scoped bulk reads keep snapshots readable while an overwrite or deletion waits', async () => {
  for (const method of ['values', 'entries']) {
    for (const mutation of ['put', 'delete']) {
      const f = await fixture()
      f.state.readGate = deferred()
      const scan = f.scope.transactionPoolStore[method]()
      await f.readStarted.promise
      // Re-registering an existing store must not create a second queue.
      await f.node.addStore('transactionPool', 'lfc', '.leofcoin/peach', false)
      let changed = false
      const write = f.store[mutation]('tx', Uint8Array.of(2)).then(() => { changed = true })
      await turn()
      assert.equal(changed, false)
      f.state.readGate.resolve()
      assert.deepEqual(await scan, method === 'values' ? [Uint8Array.of(1)] : [['tx', Uint8Array.of(1)]])
      await write
      assert.equal(await f.store.has('tx'), mutation === 'put')
      if (mutation === 'put') assert.deepEqual(await f.store.get('tx'), Uint8Array.of(2))
    }
  }
})

test('bulk scans wait for pending writes instead of inspecting temporary OPFS files', async () => {
  const f = await fixture()
  f.state.writeGate = deferred()
  const write = f.store.put('tx', Uint8Array.of(3))
  await f.writeStarted.promise
  const scan = f.store.values()
  await turn()
  assert.equal(f.state.writing, true)
  f.state.writeGate.resolve()
  await write
  assert.deepEqual(await scan, [Uint8Array.of(3)])
})

test('an active scan only holds its own store queue, not operations on another store', async () => {
  const first = await fixture(), second = await fixture()
  first.state.readGate = deferred()
  const scan = first.store.values()
  await first.readStarted.promise
  try {
    await second.store.put('tx', Uint8Array.of(5))
    assert.deepEqual(await second.store.get('tx'), Uint8Array.of(5))
  } finally {
    first.state.readGate.resolve()
    await scan
  }
})

test('persistent storage errors identify the store and operation without poisoning subsequent operations', async () => {
  const f = await fixture()
  const error = new DOMException('Access denied', 'NotReadableError')
  f.state.error = error
  await assert.rejects(f.store.values(), failure => {
    assert.match(failure.message, /transactionPool-peach values.*NotReadableError.*Access denied/)
    assert.equal(failure.cause, error)
    return true
  })
  f.state.error = undefined
  await f.store.put('tx', Uint8Array.of(4))
  assert.deepEqual(await f.store.get('tx'), Uint8Array.of(4))
})

test('existing batch operations and clear coexist with queued bulk reads', async () => {
  const f = await fixture()
  await f.store.put({ a: Uint8Array.of(2), b: Uint8Array.of(3) })
  assert.deepEqual(await f.store.get(['a', 'b']), [Uint8Array.of(2), Uint8Array.of(3)])
  assert.deepEqual(await f.store.has(['a', 'absent']), [true, false])
  assert.equal(await f.store.length(), 3)
  assert.equal(await f.store.size(), 3)
  await f.store.clear()
  assert.deepEqual(await f.store.keys(), [])
})

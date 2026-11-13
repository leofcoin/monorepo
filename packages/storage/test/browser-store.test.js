import assert from 'node:assert/strict'
import test from 'node:test'
import Storage from '@leofcoin/storage'
import { rollup } from 'rollup'
import { fileURLToPath } from 'node:url'

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
let BrowserStore
try {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { storage: { getDirectory: async () => ({}) } }
  })
  ;({ default: BrowserStore } = await import('@leofcoin/storage/browser-store'))
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

async function fixture(StorageClass = Storage) {
  const records = new Map([['tx', { bytes: Uint8Array.of(1), revision: 0 }]])
  const readStarted = deferred(), writeStarted = deferred()
  const state = { readGate: undefined, writeGate: undefined, error: undefined, handleError: undefined, writing: false,
    failKey: undefined, readKey: undefined, readCount: 0, syncAccess: false, syncGate: undefined, syncCreateCount: 0 }
  const handle = key => {
    const file = {
      kind: 'file',
      async getFile() {
        const record = records.get(key)
        if (!record) throw new DOMException('Record removed', 'NotFoundError')
        return {
          size: record.bytes.length,
          async arrayBuffer() {
            state.readCount++
            readStarted.resolve()
            if (state.failKey === key) throw state.error
            if (!state.readKey || state.readKey === key) await state.readGate?.promise
            if (state.error && !state.failKey) throw state.error
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
    }
    if (state.syncAccess) {
      file.createSyncAccessHandle = async () => {
        state.syncCreateCount++
        await state.syncGate?.promise
        const record = records.get(key)
        if (!record) throw new DOMException('Record removed', 'NotFoundError')
        return {
          getSize: () => record.bytes.length,
          read(buffer) {
            buffer.set(record.bytes)
            return record.bytes.length
          },
          write(buffer) { return buffer.length },
          close() {}
        }
      }
    }
    return file
  }
  const backend = new BrowserStore()
  backend.db = {
    async getFileHandle(key, options) {
      if (state.handleError) throw state.handleError
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
  const store = new StorageClass('transactionPool-peach')
  store.db = backend
  backend.name = store.name
  return { store, state, readStarted, writeStarted }
}

test('builtin bulk reads keep snapshots readable while an overwrite or deletion waits', async () => {
  for (const method of ['values', 'entries']) {
    for (const mutation of ['put', 'delete']) {
      const f = await fixture()
      f.state.readGate = deferred()
      const scan = f.store[method]()
      await f.readStarted.promise
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

test('browser store runs queued reads concurrently', async () => {
  const f = await fixture()
  f.state.readGate = deferred()
  const reads = [f.store.get('tx'), f.store.get('tx')]
  await turn()
  const readCount = f.state.readCount
  f.state.readGate.resolve()
  assert.deepEqual(await Promise.all(reads), [Uint8Array.of(1), Uint8Array.of(1)])
  assert.equal(readCount, 2)
})

test('browser store serializes sync handles for the same key', async () => {
  const f = await fixture()
  f.state.syncAccess = true
  f.state.syncGate = deferred()
  f.store.db.inWorker = true
  const reads = [f.store.get('tx'), f.store.get('tx')]
  await turn()
  assert.equal(f.state.syncCreateCount, 1)
  f.state.syncGate.resolve()
  assert.deepEqual(await Promise.all(reads), [Uint8Array.of(1), Uint8Array.of(1)])
  assert.equal(f.state.syncCreateCount, 2)
})

test('browser batches hold the operation queue through all writes and surface failures', async () => {
  const f = await fixture()
  f.state.writeGate = deferred()
  const write = f.store.batch([
    { type: 'put', key: 'first', value: 'one' },
    { type: 'put', key: 'second', value: 'two' },
    { type: 'del', key: 'tx' }
  ])
  await f.writeStarted.promise
  let completed = false
  const read = f.store.keys().then(keys => { completed = true; return keys })
  await turn()
  assert.equal(completed, false)
  f.state.writeGate.resolve()
  await write
  assert.deepEqual(await read, ['first', 'second'])
  assert.equal(new TextDecoder().decode(await f.store.get('second')), 'two')
  f.state.handleError = new DOMException('Write denied', 'NotAllowedError')
  await assert.rejects(f.store.batch([{ type: 'put', key: 'third', value: 'three' }]), /batch failed/)
})

test('browser batches default to get and support explicit delete operations', async () => {
  const f = await fixture()
  const results = await f.store.batch([
    { key: 'tx' },
    { type: 'put', key: 'tx', value: 'updated' },
    { key: 'tx' },
    { type: 'delete', key: 'tx' }
  ])
  assert.deepEqual(results, [Uint8Array.of(1), new TextEncoder().encode('updated')])
  assert.equal(await f.store.has('tx'), false)
})

test('has waits for queued writes and does not turn storage failures into missing keys', async () => {
  const f = await fixture()
  f.state.writeGate = deferred()
  const write = f.store.put('tx', Uint8Array.of(3))
  await f.writeStarted.promise
  let checked = false
  const has = f.store.has('tx').then(value => { checked = true; return value })
  await turn()
  assert.equal(checked, false)
  f.state.writeGate.resolve()
  await write
  assert.equal(await has, true)

  const error = new DOMException('Access denied', 'NotReadableError')
  f.state.handleError = error
  await assert.rejects(f.store.has('tx'), failure => {
    assert.equal(failure.name, error.name)
    assert.equal(failure.cause, error)
    return true
  })
  await assert.rejects(f.store.hasValue('tx'), failure => failure.cause === error)
})

test('storage passes bytes across independently bundled browser backend boundaries', async () => {
  const bundle = await rollup({
    input: fileURLToPath(new URL('../exports/storage.js', import.meta.url)),
    external: ['./browser-store.js', './store.js', 'path', 'os', 'fs/promises']
  })
  const { output } = await bundle.generate({ format: 'es' })
  await bundle.close()
  const source = Buffer.from(output[0].code).toString('base64')
  const { default: BundledStorage } = await import(`data:text/javascript;base64,${source}`)
  const { store } = await fixture(BundledStorage)
  const key = new TextEncoder().encode('contract')
  const value = Uint8Array.of(0, 127, 255)
  await store.put(key, value)
  assert.equal(await store.has('contract'), true)
  assert.deepEqual(await store.get(key), value)
  await store.delete('contract')
  assert.equal(await store.has(key), false)
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

test('iterate returns a stable queued byte snapshot while deletion waits', async () => {
  const f = await fixture()
  f.state.readGate = deferred()
  const iterating = f.store.iterate()
  await f.readStarted.promise
  let deleted = false
  const deletion = f.store.delete('tx').then(() => { deleted = true })
  await turn()
  assert.equal(deleted, false)
  f.state.readGate.resolve()
  const iterator = await iterating
  await deletion
  const entries = []
  for await (const entry of iterator) entries.push(entry)
  assert.deepEqual(entries, [['tx', Uint8Array.of(1)]])
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

test('a failed bulk read drains its remaining snapshots before releasing the queue', async () => {
  for (const method of ['values', 'entries']) {
    const f = await fixture()
    await f.store.put('slow', Uint8Array.of(2))
    f.state.error = new DOMException('Access denied', 'NotReadableError')
    f.state.failKey = 'tx'
    f.state.readKey = 'slow'
    f.state.readGate = deferred()
    const failure = assert.rejects(f.store[method](), /Access denied/)
    await f.readStarted.promise
    let written = false
    const write = f.store.put('new', Uint8Array.of(3)).then(() => { written = true })
    try {
      await turn()
      assert.equal(written, false)
    } finally {
      f.state.readGate.resolve()
    }
    await failure
    await write
    assert.deepEqual(await f.store.get('new'), Uint8Array.of(3))
  }
})

test('existing batch operations and clear coexist with queued bulk reads', async () => {
  const f = await fixture()
  await f.store.put({ a: Uint8Array.of(2), b: Uint8Array.of(3) })
  assert.deepEqual(await f.store.get(['a', 'b']), [Uint8Array.of(2), Uint8Array.of(3)])
  assert.deepEqual(await f.store.has(['a', 'absent']), [true, false])
  assert.equal(await f.store.length(), 3)
  assert.equal(await f.store.size(), 3)
  assert.deepEqual(await f.store.keys(0), [])
  assert.deepEqual(await f.store.values(0), [])
  assert.deepEqual(await f.store.entries(0), [])
  const clearing = f.store.clear()
  const afterClear = f.store.put('after-clear', Uint8Array.of(4))
  await Promise.all([clearing, afterClear])
  assert.deepEqual(await f.store.keys(), ['after-clear'])
})

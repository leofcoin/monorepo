import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ClassicLevel } from 'classic-level'
import Storage from '@leofcoin/storage'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const turn = () => new Promise(resolve => setImmediate(resolve))

test('workspace storage reopens existing ClassicLevel bytes without changing locations or encoding', async t => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-storage-'))
  const directory = join(root, 'ledger')
  let database = new ClassicLevel(directory, { valueEncoding: 'view' })
  t.after(async () => {
    await database.close()
    await rm(root, { recursive: true, force: true })
  })
  const existing = Uint8Array.of(0, 127, 255)
  await database.put('existing', existing)
  await database.close()

  const store = new Storage('ledger', root, { homedir: false })
  await store.init()
  database = store.db.db
  assert.deepEqual(await store.get('existing'), existing)
  await store.put('new', 'hello')
  await database.close()

  database = new ClassicLevel(directory, { valueEncoding: 'view' })
  assert.deepEqual(Uint8Array.from(await database.get('existing')), existing)
  assert.equal(new TextDecoder().decode(await database.get('new')), 'hello')
})

test('native batch access, bounded reads, deletion and clear retain the storage API', async t => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-storage-api-'))
  const store = new Storage('records', root, { homedir: false })
  await store.init()
  t.after(async () => {
    await store.db.db.close()
    await rm(root, { recursive: true, force: true })
  })
  await store.put({ a: 'one', b: 'two', c: 'three' })
  assert.deepEqual((await store.get(['a', 'b'])).map(bytes => new TextDecoder().decode(bytes)), ['one', 'two'])
  assert.deepEqual(await store.has(['a', 'missing']), [true, false])
  assert.deepEqual(await store.keys(2), ['a', 'b'])
  assert.equal((await store.values(1)).length, 1)
  assert.deepEqual((await store.entries()).map(([key]) => key), ['a', 'b', 'c'])
  assert.equal(await store.size(), 11)
  await store.delete('b')
  assert.equal(await store.has('b'), false)
  await store.clear()
  assert.deepEqual(await store.keys(), [])
})

test('native operations share a queue and iterate returns a stable snapshot', async t => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-storage-queue-'))
  const store = new Storage('records', root, { homedir: false })
  await store.init()
  const database = store.db.db
  t.after(async () => {
    await database.close()
    await rm(root, { recursive: true, force: true })
  })
  await store.put('key', 'old')

  const entered = deferred(), gate = deferred()
  const originalPut = database.put
  database.put = async function (...args) {
    entered.resolve()
    await gate.promise
    return originalPut.apply(this, args)
  }
  const write = store.put('key', 'new')
  await entered.promise
  let readStarted = false
  const read = store.get('key').then(value => {
    readStarted = true
    return value
  })
  await turn()
  assert.equal(readStarted, false)
  gate.resolve()
  await write
  assert.equal(new TextDecoder().decode(await read), 'new')
  database.put = originalPut

  const snapshot = await store.iterate()
  await store.put('key', 'latest')
  const entries = []
  for await (const entry of snapshot) entries.push(entry)
  assert.deepEqual(entries, [['key', new TextEncoder().encode('new')]])

  const originalGet = database.get
  const error = new Error('injected read failure')
  database.get = async () => { throw error }
  await assert.rejects(store.has('key'), failure => failure.cause === error)
  database.get = originalGet
})

test('native store runs queued reads concurrently', async t => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-storage-parallel-reads-'))
  const store = new Storage('records', root, { homedir: false })
  await store.init()
  const database = store.db.db
  t.after(async () => {
    await database.close()
    await rm(root, { recursive: true, force: true })
  })
  await store.put('first', 'one')
  await store.put('second', 'two')

  const gate = deferred()
  const originalGet = database.get
  let started = 0
  database.get = async function (...args) {
    started++
    await gate.promise
    return originalGet.apply(this, args)
  }
  const reads = [store.get('first'), store.get('second')]
  await turn()
  const concurrent = started === 2
  gate.resolve()
  assert.deepEqual(await Promise.all(reads), [new TextEncoder().encode('one'), new TextEncoder().encode('two')])
  assert.equal(concurrent, true)
  database.get = originalGet
})

test('native batches share the queue, preserve bytes and reject without partial writes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-storage-batch-'))
  const store = new Storage('records', root, { homedir: false })
  await store.init()
  const database = store.db.db
  t.after(async () => {
    await database.close()
    await rm(root, { recursive: true, force: true })
  })
  await store.put('old', 'previous')
  const entered = deferred(), gate = deferred()
  const batch = database.batch.bind(database)
  let calls = 0
  database.batch = async operations => {
    calls++
    entered.resolve()
    await gate.promise
    return batch(operations)
  }
  const write = store.batch([
    { type: 'put', key: 'first', value: Uint8Array.of(0, 255) },
    { type: 'put', key: 'second', value: 'next' },
    { type: 'del', key: 'old' }
  ])
  await entered.promise
  let completed = false
  const read = store.keys().then(keys => { completed = true; return keys })
  await turn()
  assert.equal(completed, false)
  gate.resolve()
  await write
  assert.deepEqual(await read, ['first', 'second'])
  assert.equal(calls, 1)
  assert.deepEqual(await store.get('first'), Uint8Array.of(0, 255))
  database.batch = async () => { throw new Error('injected batch failure') }
  await assert.rejects(store.batch([{ type: 'put', key: 'first', value: 'bad' }]), /batch failed/)
  assert.deepEqual(await store.get('first'), Uint8Array.of(0, 255))
})

test('native batches default to get and support explicit delete operations', async t => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-storage-batch-get-'))
  const store = new Storage('records', root, { homedir: false })
  await store.init()
  t.after(async () => {
    await store.db.db.close()
    await rm(root, { recursive: true, force: true })
  })
  await store.put('key', 'before')

  const results = await store.batch([
    { key: 'key' },
    { type: 'put', key: 'key', value: 'after' },
    { type: 'get', key: 'key' },
    { type: 'delete', key: 'key' }
  ])
  assert.deepEqual(results, [new TextEncoder().encode('before'), new TextEncoder().encode('after')])
  assert.equal(await store.has('key'), false)
})

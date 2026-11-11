import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ClassicLevel } from 'classic-level'
import Storage from '@leofcoin/storage'

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

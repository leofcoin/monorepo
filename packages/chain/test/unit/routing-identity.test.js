import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join, relative } from 'node:path'
import { nodeRoutingId } from '../../exports/routing-identity-node.js'
import { createBrowserRoutingIdentity } from '../../exports/browser/routing-identity-browser.js'

const config = { network: 'leofcoin:peach' }
const memory = () => {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
function lockManager() {
  const held = new Map(), queues = new Map()
  return { held, request: async (name, options, callback) => {
    if (options.ifAvailable && held.has(name)) return callback(null)
    const previous = queues.get(name) || Promise.resolve()
    let releaseQueue
    const queued = new Promise(resolve => { releaseQueue = resolve })
    queues.set(name, queued)
    await previous
    held.set(name, true)
    try { return await callback({ name }) }
    finally { held.delete(name); releaseQueue() }
  } }
}

test('native IDs are atomic, persistent, root-isolated and never change wallet contents', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'leofcoin-routing-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const root = relative(homedir(), directory)
  const wallet = new Uint8Array([1, 2, 3, 4])
  await writeFile(join(directory, 'wallet-fixture'), wallet)
  const ids = await Promise.all(Array.from({ length: 12 }, () => nodeRoutingId({ ...config, root })))
  assert.match(ids[0], /^lfc-peer-[a-f0-9]{32}$/)
  assert.equal(new Set(ids).size, 1, 'concurrent initialization converges on the published ID')
  assert.equal(await nodeRoutingId({ ...config, root }), ids[0])
  assert.equal(await readFile(join(directory, 'node-routing-id'), 'utf8'), ids[0])
  assert.deepEqual([...await readFile(join(directory, 'wallet-fixture'))], [...wallet])
  assert.deepEqual((await readdir(directory)).sort(), ['node-routing-id', 'wallet-fixture'])
  assert.notEqual(await nodeRoutingId({ ...config, root, storeNamespace: 'ignored-with-explicit-root' }),
    await nodeRoutingId({ ...config, root: join(root, 'second-node') }))
  await writeFile(join(directory, 'node-routing-id'), '')
  await assert.rejects(nodeRoutingId({ ...config, root }), /Invalid node routing ID/)
  assert.equal(await readFile(join(directory, 'node-routing-id'), 'utf8'), '')
})

test('explicit routing configuration does not open storage or change wallet identity', async () => {
  assert.equal(await nodeRoutingId({ routingId: 'custom-peer', root: '/not-opened' }), 'custom-peer')
  await assert.rejects(nodeRoutingId({ routingId: '' }), /Invalid node routing ID/)
})

test('browser tabs share account routing IDs; other accounts, networks and installations have distinct IDs', async () => {
  const storage = memory(), session = memory(), locks = lockManager()
  const first = createBrowserRoutingIdentity({ storage, session, locks })
  const [id, repeated] = await Promise.all([first(config), first(config)])
  assert.match(id, /^lfc-peer-[a-f0-9]{32}$/)
  assert.equal(id, repeated)
  const second = createBrowserRoutingIdentity({ storage, session, locks }) // duplicated tab's session copy
  assert.equal(await second(config), id)
  assert.equal([...storage.values.values()][0], id, 'a second tab reuses the installation/account ID')
  assert.notEqual(await first({ ...config, routingAccount: 'other-account' }), id)
  assert.notEqual(await first({ network: 'leofcoin:mainnet' }), id)
  assert.notEqual(await first({ ...config, root: '.leofcoin/peach/second-node' }), id)
  const otherInstall = createBrowserRoutingIdentity({ storage: memory(), session: memory(), locks: lockManager() })
  assert.notEqual(await otherInstall(config), id)
  assert([...storage.values.keys()].every(key => key.startsWith('leofcoin:node-routing:v1:')))
})

test('browser document restart reuses persisted routing ID after the previous document releases its locks', async () => {
  const storage = memory(), session = memory()
  const first = createBrowserRoutingIdentity({ storage, session, locks: lockManager() })
  const id = await first(config)
  // New lock manager represents origin locks after old document teardown.
  const reload = createBrowserRoutingIdentity({ storage, session, locks: lockManager() })
  assert.equal(await reload(config), id)
  const reopened = createBrowserRoutingIdentity({ storage, session: memory(), locks: lockManager() })
  assert.equal(await reopened(config), id)
})

test('browser metadata and locking failures fail closed instead of falling back to the shared wallet ID', async () => {
  const storage = memory(), session = memory(), locks = lockManager()
  await assert.rejects(createBrowserRoutingIdentity({ storage, session, locks: null })(config), /Web Locks/)
  const denied = { getItem: () => { throw new Error('storage denied') } }
  await assert.rejects(createBrowserRoutingIdentity({ storage: denied, session, locks })(config), /storage denied/)
  await createBrowserRoutingIdentity({ storage, session, locks })(config)
  const [key] = [...storage.values.keys()]
  storage.setItem(key, '')
  await assert.rejects(createBrowserRoutingIdentity({ storage, session: memory(), locks })(config), /Invalid node routing ID/)
  const explicit = createBrowserRoutingIdentity({ storage: memory(), session: memory(), locks })
  assert.equal(await explicit({ ...config, routingId: 'manual-routing' }), 'manual-routing')
  assert.equal(await createBrowserRoutingIdentity({ storage: memory(), locks })({ ...config, routingId: 'manual-routing' }), 'manual-routing')
})

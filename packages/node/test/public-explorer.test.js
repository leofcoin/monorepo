import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { encodeWire, decodeWire } from '@leofcoin/binary'
import { createPublicExplorerSource, discoverLocalNode, getExplorerSource, explorerSystemContracts } from '../src/controllers/public-explorer.js'
import {
  EXPLORER_SOURCE_STORAGE_KEY,
  getExplorerSourcePreference,
  setExplorerSourcePreference,
  SUPPORTED_NETWORKS
} from '../src/network-selection.js'
import { explorerFixture } from './explorer-fixture-data.js'

const identity = await createChainIdentity('leofcoin:peach', addresses)
const mainnetIdentity = await createChainIdentity('leofcoin:mainnet', addresses)
const fixture = await explorerFixture('fixture-public-address', addresses.nativeToken)
const network = { ...SUPPORTED_NETWORKS.peach, explorerEndpoint: 'https://public.test' }
const respond = (body, status = 200) => new Response(encodeWire('rpc', body), { status, headers: { 'Content-Type': 'application/octet-stream' } })
const status = { apiVersion: 1, chainId: identity.chainId, identity, nativeToken: addresses.nativeToken,
  tip: fixture.blocks.at(-1), synced: true, peers: [] }

test('anonymous source only performs bounded credential-free binary POST reads and has no signer', async () => {
  const requests = []
  const source = await createPublicExplorerSource(network, async (url, options) => {
    requests.push({ url: new URL(url), options })
    const path = new URL(url).pathname
    if (path === '/explorer/status') return respond(status)
    if (path === '/explorer/blocks') return respond({ apiVersion: 1, chainId: identity.chainId, blocks: [fixture.blocks[64]] })
    if (path === '/explorer/pool') return respond({ apiVersion: 1, chainId: identity.chainId, hashes: [] })
    if (path === '/explorer/transaction') return respond({ apiVersion: 1, chainId: identity.chainId, encoded: fixture.transactions.values().next().value })
    throw new Error('Unexpected public request')
  })
  assert.equal(source.kind, 'public')
  assert.equal(source.chain.nativeToken, addresses.nativeToken)
  assert.equal((await source.chain.getBlocks(64, 65))[0].index, 64n)
  await source.transactionReader(fixture.transactions.keys().next().value)
  assert.deepEqual(await source.transactionPoolStore.keys(), [])
  for (const key of ['sendTransaction', 'signer', 'participate', 'selectAccount', 'deployContract']) {
    assert.equal(source.chain[key], undefined)
    assert.equal(source.client[key], undefined)
  }
  assert.ok(requests.every(request => request.options.method === 'POST' && request.options.credentials === 'omit' && request.options.redirect === 'error'))
  assert.ok(requests.slice(1).every(request => decodeWire('rpc', request.options.body).chainId === identity.chainId && request.url.search === ''))
  await assert.rejects(source.chain.getBlocks(0, 26), /Invalid explorer block range/)
  await assert.rejects(source.client.staticCall('wallet', 'unlock'), /not exposed/)
})

test('pinned identity and network mismatches are refused without opening any wallet', async () => {
  assert.equal(identity.chainId, SUPPORTED_NETWORKS.peach.chainId)
  await assert.rejects(createPublicExplorerSource(network, async () => respond({ ...status, chainId: 'lfc:' + '0'.repeat(64) })), /identity changed/)
  await assert.rejects(createPublicExplorerSource({ ...network, network: 'leofcoin:mainnet' }, async () => respond(status)), /different chain or network/)
  await assert.rejects(createPublicExplorerSource(SUPPORTED_NETWORKS.mainnet), /No public read-only explorer/)
  await assert.rejects(createPublicExplorerSource(network, async () => respond({}, 404)), /Update the remote node/)
})

test('explorer source preference defaults to local-first and persists supported choices', () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  }
  assert.equal(getExplorerSourcePreference(storage), 'local-first')
  assert.equal(setExplorerSourcePreference('browser', storage), 'browser')
  assert.equal(values.get(EXPLORER_SOURCE_STORAGE_KEY), 'browser')
  assert.equal(getExplorerSourcePreference(storage), 'browser')
  assert.throws(() => setExplorerSourcePreference('invalid', storage), /Unsupported explorer source preference/)
  assert.equal(getExplorerSourcePreference(storage), 'browser')
})

test('local discovery reports verified chain and sync status and rejects another network', async () => {
  const node = await discoverLocalNode(SUPPORTED_NETWORKS.peach, async () => respond({ ...status, peers: ['peer-a'] }))
  assert.deepEqual(node, {
    endpoint: 'http://localhost:8080',
    network: 'leofcoin:peach',
    chainId: identity.chainId,
    synced: true,
    tipIndex: fixture.blocks.at(-1).index,
    connectedPeers: 1
  })
  await assert.rejects(discoverLocalNode(SUPPORTED_NETWORKS.mainnet, async () => respond(status)), /different chain or network/)
})

test('anonymous explorer prefers the matching local HTTP node and falls back only when unavailable', async t => {
  const previous = {
    chain: globalThis.chain,
    fetch: globalThis.fetch,
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  }
  t.after(() => {
    previous.chain === undefined ? delete globalThis.chain : globalThis.chain = previous.chain
    globalThis.fetch = previous.fetch
    if (previous.localStorage) Object.defineProperty(globalThis, 'localStorage', previous.localStorage)
    else delete globalThis.localStorage
  })
  delete globalThis.chain

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'mainnet' } })
  const calls = []
  globalThis.fetch = async url => {
    calls.push(new URL(url))
    return respond(status)
  }
  await assert.rejects(getExplorerSource(), /different chain or network/)
  assert.deepEqual(calls.map(url => url.origin), ['http://localhost:8080'])

  globalThis.fetch = async url => {
    calls.push(new URL(url))
    return respond({ ...status, chainId: mainnetIdentity.chainId, identity: mainnetIdentity })
  }
  const local = await getExplorerSource()
  assert.equal(local.kind, 'local')
  assert.equal(local.label, 'Local node · read-only')

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'peach' } })
  calls.length = 0
  globalThis.fetch = async url => {
    const origin = new URL(url).origin
    calls.push(new URL(url))
    if (origin === 'http://localhost:8080') throw new TypeError('Local node is not running')
    return respond(status)
  }
  const remote = await getExplorerSource()
  assert.equal(remote.kind, 'public')
  assert.deepEqual(calls.map(url => url.origin), ['http://localhost:8080', 'https://remote.leofcoin.org'])
})

test('local source remains separate and explorer routes no longer require wallet access', async t => {
  const previous = globalThis.chain, previousClient = globalThis.client
  const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => key === EXPLORER_SOURCE_STORAGE_KEY ? 'browser' : null }
  })
  globalThis.chain = { readOnlyFixture: true, state: { chain: 'loaded', sync: 'errored' } }
  globalThis.client = { staticCall() {} }
  t.after(() => {
    previous === undefined ? delete globalThis.chain : globalThis.chain = previous
    previousClient === undefined ? delete globalThis.client : globalThis.client = previousClient
    if (previousLocalStorage) Object.defineProperty(globalThis, 'localStorage', previousLocalStorage)
    else delete globalThis.localStorage
  })
  const source = await getExplorerSource()
  assert.equal(source.kind, 'local')
  assert.equal(source.chain, globalThis.chain)
  const shell = await readFile(new URL('../src/shell.ts', import.meta.url), 'utf8')
  const routes = shell.match(/const walletRoutes = \[([^\]]+)\]/)[1]
  assert.doesNotMatch(routes, /explorer/)
  for (const protectedRoute of ['wallet', 'identity', 'validator']) assert.match(routes, new RegExp(protectedRoute))
  const login = await readFile(new URL('../src/screens/login.ts', import.meta.url), 'utf8')
  assert.match(login, /Browse explorer without unlocking/)
  assert.ok(login.indexOf('Browse explorer without unlocking') < login.indexOf('<flex-column data-route="create">'))
  assert.match(login, /data-node-preference="local-first"/)
  assert.match(login, /data-node-preference="browser"/)
})

test('local system queries use verified genesis addresses, never the broken mutable name registry', async () => {
  const source = { chain: { getChainIdentity: async () => identity },
    client: { lookup: () => { throw new Error('Do not trust the name registry for protocol contracts') } } }
  assert.deepEqual(await explorerSystemContracts(source, network), identity.genesisContracts)
  assert.equal((await explorerSystemContracts({ identity }, network)).contractFactory, addresses.contractFactory)
  const wrong = await createChainIdentity('leofcoin:mainnet', addresses)
  await assert.rejects(explorerSystemContracts({ identity: wrong }, network), /different chain or network/)
  await assert.rejects(explorerSystemContracts({ identity: { ...identity, chainId: 'lfc:' + '0'.repeat(64) } }, network), /identity|ID/)
})

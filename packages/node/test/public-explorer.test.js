import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { encodeWire, decodeWire } from '@leofcoin/binary'
import { createPublicExplorerSource, getExplorerSource } from '../src/controllers/public-explorer.js'
import { SUPPORTED_NETWORKS } from '../src/network-selection.js'
import { explorerFixture } from './explorer-fixture-data.js'

const identity = await createChainIdentity('leofcoin:peach', addresses)
const fixture = await explorerFixture('fixture-public-address', addresses.nativeToken)
const network = { ...SUPPORTED_NETWORKS.peach, explorerEndpoint: 'https://public.test' }
const respond = (body, status = 200) => new Response(encodeWire('rpc', body), { status, headers: { 'Content-Type': 'application/octet-stream' } })
const status = { apiVersion: 1, chainId: identity.chainId, identity, nativeToken: addresses.nativeToken, tip: fixture.blocks.at(-1), peers: [] }

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
  await assert.rejects(source.chain.getBlocks(0, 26), /Invalid public block range/)
  await assert.rejects(source.client.staticCall('wallet', 'unlock'), /not exposed/)
})

test('pinned identity and network mismatches are refused without opening any wallet', async () => {
  assert.equal(identity.chainId, SUPPORTED_NETWORKS.peach.chainId)
  await assert.rejects(createPublicExplorerSource(network, async () => respond({ ...status, chainId: 'lfc:' + '0'.repeat(64) })), /identity changed/)
  await assert.rejects(createPublicExplorerSource({ ...network, network: 'leofcoin:mainnet' }, async () => respond(status)), /different chain or network/)
  await assert.rejects(createPublicExplorerSource(SUPPORTED_NETWORKS.mainnet), /No public read-only explorer/)
  await assert.rejects(createPublicExplorerSource(network, async () => respond({}, 404)), /Update the remote node/)
})

test('local source remains separate and explorer routes no longer require wallet access', async t => {
  const previous = globalThis.chain
  globalThis.chain = { readOnlyFixture: true }
  t.after(() => previous === undefined ? delete globalThis.chain : globalThis.chain = previous)
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
})

import test from 'node:test'
import assert from 'node:assert/strict'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { BlockMessage, TransactionMessage } from '@leofcoin/messages'
import { explorerMiddleware } from '../exports/explorer.js'

const identity = await createChainIdentity('leofcoin:peach', addresses)
const transaction = new TransactionMessage({ from: 'fixture-address', to: addresses.nativeToken, method: 'transfer', params: ['fixture-recipient', '1'], timestamp: 1, signature: '', nonce: 1 })
const transactionHash = await transaction.hash()
const message = new BlockMessage({ index: 0n, previousHash: '0x0', timestamp: 1, reward: 0n, fees: 1n,
  transactions: [transactionHash], validators: [], producer: '', producerProof: '', protocolVersion: '0.4.0' })
const hash = await message.hash()
const block = { ...message.decoded, hash, loaded: true }

function setup(t) {
  const keys = ['peernet', 'blockStore', 'transactionStore', 'transactionPoolStore', 'walletStore']
  const original = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  t.after(() => { for (const key of keys) original[key] === undefined ? delete globalThis[key] : globalThis[key] = original[key] })
  const store = entries => ({ has: async key => entries.has(key), get: async key => entries.get(key), keys: async limit => [...entries.keys()].slice(0, limit), length: async () => entries.size, size: async () => 10 })
  globalThis.peernet = { connections: { fixture: { connected: true } }, get: () => { throw new Error('Network fetch forbidden') } }
  globalThis.walletStore = new Proxy({}, { get: () => { throw new Error('Wallet access forbidden') } })
  globalThis.blockStore = store(new Map([[hash, message.encoded]]))
  globalThis.transactionStore = store(new Map([[transactionHash, transaction.encoded]]))
  globalThis.transactionPoolStore = store(new Map())
  let writes = 0
  const chain = { getChainIdentity: async () => identity, lastBlock: block, state: { sync: 'synced' },
    getBlocks: async (from, to) => [block].slice(from, to), sendTransaction: () => { writes++; },
    staticCall: async (_, method) => method === 'validators' ? [] : 0,
    nativeCalls: 1n, nativeMints: 0n, nativeBurns: 0n, nativeTransfers: 1n, totalContracts: 4n,
    totalTransactions: 1n, totalSize: 10, balances: { alice: 10n, bob: 30n } }
  const middleware = explorerMiddleware(chain)
  const request = async (resource, query = {}, method = 'POST') => {
    const ctx = { path: `/explorer/${resource}`, method, state: { rpcParams: { chainId: identity.chainId, ...query } }, set() {} }
    await middleware(ctx, () => { throw new Error('Unexpected next middleware') })
    return { status: ctx.status || 200, body: ctx.body }
  }
  return { chain, request, writes: () => writes }
}

test('public status, canonical pages and encoded content are read-only and wallet-free', async t => {
  const { request, writes } = setup(t)
  const status = await request('status')
  assert.equal(status.body.identity.chainId, identity.chainId)
  const blocks = await request('blocks', { from: '0', count: '25' })
  assert.equal(blocks.body.blocks[0].index, 0n)
  const content = await request('block', { hash })
  assert.equal(await new BlockMessage(content.body.encoded).hash(), hash)
  const tx = await request('transaction', { hash: transactionHash })
  assert.equal(await new TransactionMessage(tx.body.encoded).hash(), transactionHash)
  assert.deepEqual((await request('pool')).body.hashes, [])
  assert.equal(writes(), 0)
})

test('writes, oversized ranges, wrong chains and unknown actions are rejected', async t => {
  const { request, writes } = setup(t)
  assert.equal((await request('submit', {}, 'GET')).status, 405)
  assert.equal((await request('submit')).status, 404)
  assert.equal((await request('blocks', { from: '0', count: '26' })).status, 400)
  assert.equal((await request('blocks', { from: '-1', count: '25' })).status, 400)
  assert.equal((await request('pool', { chainId: 'lfc:' + '0'.repeat(64) })).status, 409)
  assert.equal((await request('transaction', { hash: '../wallet' })).status, 400)
  assert.equal(writes(), 0)
})

test('missing content never triggers peer discovery; corrupt stored bytes are rejected', async t => {
  const { request } = setup(t)
  assert.equal((await request('block', { hash: 'A'.repeat(64) })).status, 404)
  globalThis.blockStore = { has: async () => true, get: async () => transaction.encoded }
  assert.equal((await request('block', { hash })).status, 503)
})

test('overview returns bounded holder rankings with the full supply denominator', async t => {
  const { request } = setup(t)
  const { body } = await request('overview')
  assert.equal(body.holders.total, 2)
  assert.equal(body.holders.holders[0].address, 'bob')
  assert.equal(body.holders.holders[0].balance, 30n)
  assert.equal(body.holders.holders[0].share, 75)
})

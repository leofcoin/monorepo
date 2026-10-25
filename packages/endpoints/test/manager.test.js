import assert from 'node:assert/strict'
import test from 'node:test'
import http from '../exports/http.js'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { createTransactionHash, signTransaction } from '@leofcoin/lib'
import { TransactionMessage, ContractMessage } from '@leofcoin/messages'
import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'

const identity = await createChainIdentity('leofcoin:peach', {
  nativeToken: 'A'.repeat(52), contractFactory: 'B'.repeat(52),
  validators: 'C'.repeat(52), nameService: 'D'.repeat(52)
})
const wallet = new MultiWallet('leofcoin:peach')
await wallet.generate(undefined, 'leofcoin:peach')
const from = await wallet.address
const raw = { from, to: identity.genesisContracts.nativeToken, method: 'transfer', params: [from, '1'], nonce: 1, timestamp: Date.now() }
const signed = await signTransaction(raw, { sign: hash => wallet.sign(hash.subarray(0, 32)) })

async function setup(t, overrides = {}) {
  let resolve, reject
  const wait = new Promise((accept, fail) => { resolve = accept; reject = fail })
  const calls = []
  const writes = []
  const previousPeer = globalThis.peernet
  const previousStore = globalThis.contractStore
  const previousChainStore = globalThis.chainStore
  const durable = new Map()
  globalThis.chainStore = {
    has: async key => durable.has(key), get: async key => durable.get(key),
    put: async (key, value) => durable.set(key, value)
  }
  globalThis.peernet = { connections: { test: { connected: true } } }
  globalThis.contractStore = { put: async (...args) => writes.push(args) }
  t.after(() => { globalThis.peernet = previousPeer; globalThis.contractStore = previousStore; globalThis.chainStore = previousChainStore })
  const blocks = new Map([[1, { index: 1, hash: 'initial', transactions: [] }]])
  const chain = {
    getChainIdentity: async () => identity,
    lastBlock: { index: 1n, hash: 'initial' }, state: { sync: 'synced' },
    getBlocks: async (from, to) => [...blocks.values()].filter(block => block.index >= from && block.index < to),
    balanceOf: async () => 100000000000000000000n, getNonce: async () => 0,
    staticCall: async () => 42n,
    validateTransactionSignature: async transaction => {
      const verifier = new MultiWallet('leofcoin:peach')
      await verifier.fromAddress(transaction.decoded.from, null, 'leofcoin:peach')
      if (!await verifier.verify(base58.decode(transaction.decoded.signature), await createTransactionHash(transaction)))
        throw new Error('Signature mismatch')
    },
    sendTransaction: async transaction => {
      calls.push(transaction)
      return { hash: await new TransactionMessage(transaction).hash(), wait }
    },
    ...overrides
  }
  let server = http(chain, 0, 'peach')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  let url = `http://127.0.0.1:${server.address().port}/manager/rpc`
  const request = body => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chainId: identity.chainId, ...body })
  })
  const include = async hash => {
    const block = { index: Number((await chain.lastBlock).index) + 1, hash: `canonical-${blocks.size}`, transactions: [hash] }
    blocks.set(block.index, block)
    chain.lastBlock = block
  }
  return {
    request, url, calls, writes, chain, durable, blocks, include, resolve, reject,
    async restart() {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
      server = http(chain, 0, 'peach')
      await new Promise(resolve => server.once('listening', resolve))
      url = `http://127.0.0.1:${server.address().port}/manager/rpc`
    }
  }
}

test('management status is public and chain-pinned; old HTTP routes remain intact', async t => {
  const { request, url } = await setup(t)
  const response = await request({ action: 'status', account: from })
  assert.equal(response.status, 200)
  const status = await response.json()
  assert.equal(status.balance, '100000000000000000000')
  assert.equal(status.peers, 1)
  assert.equal(status.apiVersion, 1)
  assert.equal((await fetch(url)).status, 405)
  assert.equal((await fetch(url.replace('/manager/rpc', '/chainIdentity'))).status, 200)
  assert.equal((await request({ action: 'status', chainId: `lfc:${'0'.repeat(64)}` })).status, 409)
  assert.equal((await request({ action: 'read', contract: identity.genesisContracts.nativeToken, method: 'balanceOf', params: [from] })).status, 200)
})

test('signed submissions are deduplicated and only canonical wait resolves confirmation', async t => {
  const { request, calls, resolve, include } = await setup(t)
  const response = await request({ action: 'submit', transaction: signed })
  assert.equal(response.status, 200)
  const receipt = await response.json()
  assert.equal(receipt.status, 'pending')
  assert.deepEqual(await (await request({ action: 'submit', transaction: signed })).json(), receipt)
  assert.equal(calls.length, 1)
  assert.equal((await (await request({ action: 'receipt', hash: receipt.hash })).json()).status, 'pending')
  await include(receipt.hash)
  resolve(receipt.hash)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal((await (await request({ action: 'receipt', hash: receipt.hash })).json()).status, 'confirmed')
})

test('restart restores admission and proves confirmation from canonical blocks without rebroadcast', async t => {
  const { request, calls, restart, include, chain } = await setup(t)
  const receipt = await (await request({ action: 'submit', transaction: signed })).json()
  await restart()
  const unresolved = await (await request({ action: 'receipt', hash: receipt.hash })).json()
  assert.equal(unresolved.status, 'unknown')
  assert.match(unresolved.error, /do not resend/)
  assert.equal((await (await request({ action: 'submit', transaction: signed })).json()).status, 'unknown')
  assert.equal(calls.length, 1)
  await include(receipt.hash)
  chain.lastBlock = Promise.resolve(chain.lastBlock)
  const confirmed = await (await request({ action: 'receipt', hash: receipt.hash })).json()
  assert.equal(confirmed.status, 'confirmed')
  assert.equal(confirmed.blockHeight, 2)
  assert.equal(calls.length, 1)
  await restart()
  assert.equal((await (await request({ action: 'receipt', hash: receipt.hash })).json()).status, 'confirmed')
})

test('durable reservation failure blocks admission; crash-window reservations prevent resend', async t => {
  const { request, calls, durable, restart } = await setup(t)
  const put = globalThis.chainStore.put
  globalThis.chainStore.put = async () => { throw new Error('disk full') }
  assert.equal((await request({ action: 'submit', transaction: signed })).status, 400)
  assert.equal(calls.length, 0)
  globalThis.chainStore.put = put
  const hash = await new TransactionMessage(signed).hash()
  durable.set(`manager:receipts:v1:${identity.chainId}`, new TextEncoder().encode(JSON.stringify([
    { hash, status: 'submitting', createdAt: Date.now(), startHeight: 1 }
  ])))
  await restart()
  assert.equal((await (await request({ action: 'submit', transaction: signed })).json()).status, 'submitting')
  assert.equal(calls.length, 0)
  assert.equal((await (await request({ action: 'receipt', hash })).json()).status, 'unknown')
})

test('reconciliation is bounded, persists progress and rechecks canonical inclusion after a fork', async t => {
  const { request, restart, blocks, chain } = await setup(t)
  const receipt = await (await request({ action: 'submit', transaction: signed })).json()
  for (let index = 2; index <= 300; index++) blocks.set(index, {
    index, hash: `block-${index}`, transactions: index === 290 ? [receipt.hash] : []
  })
  chain.lastBlock = blocks.get(300)
  await restart()
  const first = await (await request({ action: 'receipt', hash: receipt.hash })).json()
  assert.equal(first.status, 'unknown')
  assert.equal(first.scannedHeight, 128)
  await restart()
  assert.equal((await (await request({ action: 'receipt', hash: receipt.hash })).json()).scannedHeight, 256)
  assert.equal((await (await request({ action: 'receipt', hash: receipt.hash })).json()).blockHeight, 290)
  blocks.set(290, { index: 290, hash: 'fork-290', transactions: [] })
  chain.lastBlock = { ...blocks.get(300), hash: 'fork-tip' }
  const forked = await (await request({ action: 'receipt', hash: receipt.hash })).json()
  assert.equal(forked.status, 'unknown')
  assert.equal(forked.blockHeight, undefined)
})

test('concurrent duplicate uploads are admitted only once after async validation', async t => {
  const { request, calls } = await setup(t)
  const responses = await Promise.all(Array.from({ length: 4 }, () => request({ action: 'submit', transaction: signed })))
  for (const response of responses) assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
})

test('canonical rejection reports failed; uncertain admission never reports success', async t => {
  const { request, reject } = await setup(t)
  const receipt = await (await request({ action: 'submit', transaction: signed })).json()
  reject(new Error('Execution rejected'))
  await new Promise(resolve => setImmediate(resolve))
  const rejected = await (await request({ action: 'receipt', hash: receipt.hash })).json()
  assert.equal(rejected.status, 'failed')
  assert.match(rejected.error, /Execution rejected/)
})

test('invalid signatures, uploads and mismatched chain never reach submission or storage', async t => {
  const { request, calls, writes } = await setup(t)
  const contract = new ContractMessage({ creator: from, contract: 'export default class Example {}', constructorParameters: [] })
  const bad = await request({ action: 'submit', transaction: signed, contract: await contract.toString() })
  assert.equal(bad.status, 400)
  const invalid = await request({ action: 'submit', transaction: { ...signed, params: [from, '2'] } })
  assert.equal(invalid.status, 400)
  assert.equal(calls.length, 0)
  assert.equal(writes.length, 0)
})

test('matching signed factory upload persists the exact encoded contract', async t => {
  const { request, writes } = await setup(t)
  const contract = new ContractMessage({ creator: from, contract: 'export default class Example {}', constructorParameters: [] })
  const registration = await signTransaction({
    ...raw, to: identity.genesisContracts.contractFactory, method: 'registerContract', params: [await contract.hash()]
  }, { sign: hash => wallet.sign(hash.subarray(0, 32)) })
  const receipt = await (await request({ action: 'submit', transaction: registration, contract: await contract.toString() })).json()
  assert.equal(receipt.status, 'pending')
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0], await contract.hash())
  assert.deepEqual(writes[0][1], contract.encoded)
})

test('disconnected nodes reject writes and malformed/oversized requests are bounded', async t => {
  const { request, url } = await setup(t, { state: { sync: 'syncing' } })
  assert.equal((await request({ action: 'submit', transaction: signed })).status, 503)
  assert.equal((await request({ action: 'unknown' })).status, 400)
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 415)
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400)
  assert.equal((await request({ action: 'status', padding: 'x'.repeat(1_048_576) })).status, 413)
})

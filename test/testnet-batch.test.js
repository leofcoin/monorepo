import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import MultiWallet from '@leofcoin/multi-wallet'
import HttpClient from '@leofcoin/endpoint-clients/http'
import http from '@leofcoin/endpoints/http'
import { TransactionMessage } from '@leofcoin/messages'
import { calculateFee, createTransactionHash } from '@leofcoin/lib'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { parseBatchOptions, runBatch, loadBatchSigner } from '../scripts/testnet-batch.js'

const options = (extra = []) => parseBatchOptions([
  '--endpoint', 'http://127.0.0.1:8080', '--from', 'sender', '--to', 'recipient', '--count', '10',
  '--wallet-file', '/explicit/encrypted-wallet', '--password-file', '/explicit/password',
  '--output', '/explicit/new-journal', ...extra
])
const fixture = async (changes = {}) => {
  const identity = await createChainIdentity('leofcoin:peach', addresses)
  const state = { signed: [], sends: [], entries: [], active: 0, maximum: 0, nonceReads: 0, walletReads: 0 }
  const client = {
    async _fetch(method) {
      if (method === 'chainIdentity') return changes.identity ?? identity
      if (method === 'manager/rpc') return { chainId: identity.chainId, synced: true, peers: 1, ...changes.status }
      if (method === 'getNonce') return changes.nonce?.(++state.nonceReads) ?? 0n
      assert.fail(`unexpected RPC ${method}`)
    },
    async staticCall() { return changes.balance ?? 10n ** 30n },
    async submitTransaction(transaction, chainId) {
      assert.equal(chainId, identity.chainId)
      state.sends.push(transaction)
      state.active++
      state.maximum = Math.max(state.maximum, state.active)
      try {
        await new Promise(resolve => setImmediate(resolve))
        if (changes.fail) throw new Error('lost response')
        return { status: 'admitted', hash: `hash-${transaction.nonce}`, chainId, ...changes.receipt }
      } finally { state.active-- }
    }
  }
  return { state, deps: {
    client, loadSigner: async () => { state.walletReads++; return {} },
    sign: async raw => { state.signed.push(raw.nonce); return { ...raw, signature: 'fixture' } },
    fee: async () => 2n,
    message: signed => ({ decoded: signed, hash: async () => `hash-${signed.nonce}` }),
    journal: async entry => { state.entries.push(entry) }, log() {}
  } }
}

test('batch options require deliberate confirmation and support more or fewer than 100k', () => {
  assert.equal(options().confirm, false)
  assert.equal(options(['--count', '250000', '--concurrency', '128']).count, 250000)
  assert.equal(options(['--count', '1']).count, 1)
  for (const args of [
    ['--count', '0'], ['--count', '-1'], ['--count', '1.5'], ['--count', '9007199254740992'],
    ['--concurrency', '1025'], ['--amount', '0'], ['--amount', '1.5'],
    ['--endpoint', 'http://user:password@localhost:8080'], ['--unknown']
  ]) assert.throws(() => options(args))
  assert.throws(() => parseBatchOptions(['--endpoint', 'http://localhost', '--from', 'a', '--to', 'b', '--confirm-testnet-send']),
    /wallet-file/)
})

test('preview does not unlock a wallet, sign, journal or send transactions', async () => {
  const { state, deps } = await fixture()
  const result = await runBatch(options(), deps)
  assert.equal(result.status, 'preview')
  assert.equal(state.walletReads, 0)
  assert.equal(state.sends.length, 0)
  assert.equal(state.entries.length, 0)
})

test('wrong network, missing peers and unsynced endpoints fail before signing or admission', async () => {
  for (const changes of [
    { identity: await createChainIdentity('leofcoin', addresses) },
    { status: { synced: false } }, { status: { peers: 0 } }
  ]) {
    const { state, deps } = await fixture(changes)
    await assert.rejects(runBatch(options(['--confirm-testnet-send']), deps))
    assert.equal(state.walletReads, 0)
    assert.equal(state.sends.length, 0)
  }
})

test('exact fee budget and nonce changes reject the entire burst before sending', async () => {
  for (const changes of [{ balance: 29n }, { nonce: n => n === 1 ? 0n : 1n }]) {
    const { state, deps } = await fixture(changes)
    await assert.rejects(runBatch(options(['--confirm-testnet-send']), deps), /Insufficient balance|nonce changed/)
    assert.equal(state.signed.length, 10)
    assert.equal(state.sends.length, 0)
  }
  const { deps } = await fixture({ nonce: () => BigInt(Number.MAX_SAFE_INTEGER) })
  await assert.rejects(runBatch(options(['--confirm-testnet-send']), deps), /Nonce range/)
})

test('100000 submissions use unique sequential nonces, bounded concurrency and exact output counts', async () => {
  const { state, deps } = await fixture()
  let entries = 0
  deps.journal = async entry => {
    entries++
    if (entry.status === 'prepared') assert.equal(state.signed.length, 100000, 'presign before first request')
  }
  const result = await runBatch(options(['--confirm-testnet-send', '--count', '100000', '--concurrency', '32']), deps)
  assert.deepEqual(result, { status: 'admitted', requested: 100000, attempted: 100000, admitted: 100000, unsent: 0, finalized: false })
  assert.equal(state.maximum, 32)
  assert.equal(new Set(state.sends.map(tx => tx.nonce)).size, 100000)
  assert.deepEqual(state.sends.map(tx => tx.nonce), Array.from({ length: 100000 }, (_, index) => index + 1))
  assert.equal(entries, 200002)
})

test('unknown admission stops new sends, drains in-flight requests and never retries', async () => {
  const { state, deps } = await fixture({ fail: true })
  await assert.rejects(runBatch(options(['--confirm-testnet-send', '--concurrency', '3']), deps), /reconcile/)
  assert.equal(state.sends.length, 3)
  assert.equal(state.active, 0)
  assert.equal(state.entries.filter(entry => entry.status === 'unknown').length, 3)
  assert.equal(state.entries.at(-1).unsent, 7)
})

test('mismatched hash or chain ID cannot count as admitted', async () => {
  for (const receipt of [{ hash: 'wrong' }, { chainId: 'wrong' }]) {
    const { state, deps } = await fixture({ receipt })
    await assert.rejects(runBatch(options(['--confirm-testnet-send', '--concurrency', '1']), deps), /reconcile/)
    assert.equal(state.entries.at(-1).admitted, 0)
    assert.equal(state.sends.length, 1)
  }
})

test('failed intent journal or an abort prevents sending', async () => {
  const { state, deps } = await fixture()
  deps.journal = async entry => { if (entry.status === 'attempting') throw new Error('disk full') }
  await assert.rejects(runBatch(options(['--confirm-testnet-send']), deps), /disk full|reconcile/)
  assert.equal(state.sends.length, 0)
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await assert.rejects(runBatch(options(['--confirm-testnet-send']), { ...deps, signal: controller.signal }), /cancelled/)
  assert.equal(state.sends.length, 0)
})

test('abort between durable intent and dispatch counts the transaction as unsent', async () => {
  const { state, deps } = await fixture()
  const controller = new AbortController()
  deps.journal = async entry => {
    state.entries.push(entry)
    if (entry.status === 'attempting') controller.abort(new Error('cancelled before HTTP'))
  }
  await assert.rejects(runBatch(options(['--confirm-testnet-send', '--concurrency', '1']),
    { ...deps, signal: controller.signal }), /reconcile/)
  assert.equal(state.sends.length, 0)
  assert.equal(state.entries.at(-1).attempted, 0)
  assert.equal(state.entries.at(-1).unsent, 10)
  assert.equal(state.entries.some(entry => entry.status === 'not-sent'), true)
})

test('encrypted signer import signs only for its matching explicit address', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-batch-signer-'))
  try {
    const wallet = new MultiWallet('leofcoin:peach')
    await wallet.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1), undefined, 'leofcoin:peach')
    const walletFile = join(root, 'wallet')
    const passwordFile = join(root, 'password')
    await writeFile(walletFile, await wallet.export('fixture-only'), { mode: 0o600 })
    await writeFile(passwordFile, 'fixture-only\n', { mode: 0o600 })
    const loaded = await loadBatchSigner({ walletFile, passwordFile, from: await wallet.address })
    assert.equal(await loaded.address, await wallet.address)
    await assert.rejects(loadBatchSigner({ walletFile, passwordFile, from: 'wrong' }), /does not match/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('real local signing, binary HTTP client and admission endpoint work end to end without finalization', async t => {
  const identity = await createChainIdentity('leofcoin:peach', addresses)
  const wallet = new MultiWallet('leofcoin:peach')
  await wallet.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1), undefined, 'leofcoin:peach')
  const from = await wallet.address
  const admitted = []
  const previous = globalThis.peernet
  globalThis.peernet = { connections: { fixture: { connected: true } } }
  const chain = {
    state: { sync: 'synced' }, lastBlock: { index: 0n, hash: '0x0' },
    getChainIdentity: async () => identity, getNonce: async () => 0,
    balanceOf: async () => 1000000n, staticCall: async () => 1000000n,
    sendTransaction: async signed => {
      const transaction = new TransactionMessage(signed)
      assert.equal(await wallet.verify(fromBase58(signed.signature), await createTransactionHash(transaction)), true)
      assert.equal(signed.from, from)
      admitted.push(signed.nonce)
      return { hash: await transaction.hash(), fee: await calculateFee(transaction),
        wait: new Promise(() => {}) }
    }
  }
  const server = http(chain, 0, 'peach')
  t.after(() => { server.close(); globalThis.peernet = previous })
  await new Promise(resolve => server.once('listening', resolve))
  const endpoint = `http://127.0.0.1:${server.address().port}`
  const opts = { ...options(['--confirm-testnet-send', '--count', '12', '--concurrency', '3']), endpoint, from }
  const result = await runBatch(opts, {
    client: new HttpClient(endpoint, 'peach'), loadSigner: async () => wallet, journal: async () => {}, log() {}
  })
  assert.equal(result.admitted, 12)
  assert.equal(result.finalized, false)
  assert.deepEqual(admitted.toSorted((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index + 1))
})

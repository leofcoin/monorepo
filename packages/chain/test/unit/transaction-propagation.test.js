import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { TransactionMessage } from '@leofcoin/messages'
import { enqueueTransaction } from '../../src/consensus/transaction-pool.ts'
import { resolveTransactionReference } from '../../src/consensus/transaction-reference.ts'
import { methods } from '../helpers/canonical-state-harness.js'

const production = methods('../../src/chain.ts', 'Chain', [
  '#sendTransaction', 'getPeerTransactionPool', '#peerConnected'
])
const source = ts.transpile(`
  return class Harness {
    #participating = false
    #runningEpoch = false
    wantList = []
    machine = { states: {} }
    version = '0.4.0'
    lastBlock = { index: 921n, hash: 'tip' }
    nonces = []
    epochs = 0
    synced = []
    async #runEpoch() { this.epochs++ }
    async #makeRequest(peer, method) { return peer.request(method) }
    async #recordPeerFailure(id, reason) { throw new Error(reason) }
    async #decodeKnownBlocksResponse(value) { return value }
    async triggerSync() {}
    async syncChain(block) { this.synced.push(block) }
    isVersionCompatible(version) { return version === this.version }
    async validateTransactionSignature(transaction) {
      if (transaction.decoded.signature !== 'signature') throw new Error('invalid signature')
    }
    addPendingNonce(address, nonce) { this.nonces.push([address, nonce]) }
    receive(transaction) { return this.#sendTransaction(transaction) }
    connect(id) { return this.#peerConnected(id) }
    participate() { this.#participating = true }
    ${production}
  }
`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })

const createNode = () => {
  const pending = new Map()
  const canonical = new Map()
  const messages = []
  const logs = []
  const timers = []
  const neighbours = []
  const store = (map) => ({
    async has(hash) { return map.has(hash) },
    async put(hash, bytes) { map.set(hash, bytes) },
    async keys() { return [...map.keys()] }
  })
  const peernet = {
    async publish(topic, bytes) {
      messages.push(topic)
      for (const neighbour of neighbours) await neighbour.chain.receive(bytes)
    },
    async get(hash, name) {
      assert.equal(name, 'transactionPool')
      return neighbours.map(node => node.pending.get(hash)).find(Boolean)
    },
    getConnection(id) {
      return {
        version: '0.4.0',
        async request(method) {
          if (method === 'lastBlock') return { index: 921n, hash: 'tip' }
          if (method === 'stateInfo') return {}
          if (method === 'transactionPool') return [...neighbours[0].pending.keys()]
          throw new Error(`unexpected request ${method}`)
        }
      }
    }
  }
  const globals = {
    peernet,
    transactionPoolStore: store(pending),
    transactionStore: store(canonical)
  }
  const Harness = new Function(
    'globalThis', 'peernet', 'TransactionMessage', 'enqueueTransaction',
    'resolveTransactionReference', 'debug', 'setTimeout', 'resolveLastBlockMessage', 'console',
    source
  )(
    globals, peernet, TransactionMessage, enqueueTransaction, resolveTransactionReference,
    (...args) => logs.push(args), callback => timers.push(callback),
    async decoded => ({ decoded }), { log() {}, error() {} }
  )
  return { chain: new Harness(), pending, canonical, messages, logs, timers, neighbours, peernet }
}

const transaction = (overrides = {}) => new TransactionMessage({
  from: 'sender',
  to: 'token',
  method: 'transfer',
  params: ['recipient', 1n],
  timestamp: 1,
  nonce: 1,
  signature: 'signature',
  ...overrides
})

test('relays a browser transaction through an intermediate node to a validator without loops', async () => {
  const browser = createNode()
  const intermediate = createNode()
  const validator = createNode()
  browser.neighbours.push(intermediate)
  intermediate.neighbours.push(browser, validator)
  validator.neighbours.push(intermediate)
  validator.chain.participate()
  const message = transaction()
  const hash = await message.hash()

  await browser.chain.receive(message.encoded)

  for (const node of [browser, intermediate, validator]) {
    assert.deepEqual(node.pending.get(hash), message.encoded)
    assert.deepEqual(node.messages, ['add-transaction'])
    assert.ok(node.chain.nonces.some(([address, nonce]) => address === 'sender' && nonce === 1))
  }
  assert.ok(validator.chain.epochs > 0)
  await intermediate.chain.receive(message.encoded)
  assert.deepEqual(intermediate.messages, ['add-transaction'])
})

test('does not reintroduce or relay a canonically confirmed transaction', async () => {
  const node = createNode()
  const message = transaction()
  const hash = await message.hash()
  node.canonical.set(hash, message.encoded)

  assert.equal(await node.chain.receive(message.encoded), hash)
  assert.equal(node.pending.size, 0)
  assert.deepEqual(node.messages, [])
  assert.deepEqual(node.chain.nonces, [])
})

test('logs asynchronous relay failure but retains the accepted pool entry for recovery', async () => {
  const node = createNode()
  node.peernet.publish = async () => { throw new Error('disconnected') }
  const message = transaction()

  assert.equal(await node.chain.receive(message.encoded), await message.hash())
  assert.equal(node.pending.size, 1)
  assert.ok(node.logs.some(args => args.join(' ').includes('disconnected')))
})

test('recovers a missed publication on reconnect at equal height from the pending store', async () => {
  const browser = createNode()
  const validator = createNode()
  const message = transaction()
  const hash = await message.hash()
  browser.pending.set(hash, message.encoded)
  validator.neighbours.push(browser)

  await validator.chain.connect('browser')
  assert.equal(validator.timers.length, 1)
  await validator.timers[0]()

  assert.deepEqual(validator.pending.get(hash), message.encoded)
  assert.deepEqual(validator.chain.nonces, [['sender', 1]])
  assert.equal(validator.chain.synced.length, 1)
})

test('pool recovery rejects mismatched hashes and invalid signatures and continues with valid entries', async () => {
  const browser = createNode()
  const validator = createNode()
  const valid = transaction()
  const invalid = transaction({ signature: 'bad-signature', nonce: 2 })
  const validHash = await valid.hash()
  const invalidHash = await invalid.hash()
  browser.pending.set('wrong-hash', valid.encoded)
  browser.pending.set(invalidHash, invalid.encoded)
  browser.pending.set(validHash, valid.encoded)
  validator.neighbours.push(browser)

  const recovered = await validator.chain.getPeerTransactionPool(validator.peernet.getConnection('browser'))

  assert.deepEqual(recovered, [validHash])
  assert.deepEqual([...validator.pending.keys()], [validHash])
  assert.deepEqual(validator.chain.nonces, [['sender', 1]])
  assert.ok(validator.logs.some(args => args.join(' ').includes('Transaction hash mismatch')))
  assert.ok(validator.logs.some(args => args.join(' ').includes('invalid signature')))
})

test('recovers pending transactions from compatible peers before the first block exists', async () => {
  const browser = createNode()
  const receiver = createNode()
  const message = transaction()
  const hash = await message.hash()
  browser.pending.set(hash, message.encoded)
  receiver.neighbours.push(browser)
  receiver.chain.lastBlock = { index: -1n, hash: '0x0' }
  const peer = receiver.peernet.getConnection('browser')
  const request = peer.request
  peer.request = method => method === 'lastBlock'
    ? Promise.resolve({ index: -1n, hash: '0x0' })
    : request(method)
  receiver.peernet.getConnection = () => peer

  await receiver.chain.connect('browser')
  assert.equal(receiver.timers.length, 1)
  await receiver.timers[0]()

  assert.deepEqual(receiver.pending.get(hash), message.encoded)
  assert.deepEqual(receiver.chain.synced, [])
})

test('pool recovery skips already-pending and canonical hashes', async () => {
  const browser = createNode()
  const validator = createNode()
  const message = transaction()
  const hash = await message.hash()
  browser.pending.set(hash, message.encoded)
  validator.neighbours.push(browser)
  validator.canonical.set(hash, message.encoded)
  validator.peernet.get = async () => { throw new Error('must not fetch') }

  assert.deepEqual(await validator.chain.getPeerTransactionPool(validator.peernet.getConnection('browser')), [])
  validator.canonical.clear()
  validator.pending.set(hash, message.encoded)
  assert.deepEqual(await validator.chain.getPeerTransactionPool(validator.peernet.getConnection('browser')), [])
  assert.deepEqual(validator.chain.nonces, [])
})

test('pool recovery logs unavailable entries and continues', async () => {
  const node = createNode()
  const peer = { async request() { return ['missing'] } }

  assert.deepEqual(await node.chain.getPeerTransactionPool(peer), [])
  assert.ok(node.logs.some(args => args.join(' ').includes('pending transaction body unavailable')))
})

test('pool recovery accepts byte and string JSON responses, rejecting malformed lists explicitly', async () => {
  const node = createNode()
  for (const response of ['[]', new TextEncoder().encode('[]')]) {
    assert.deepEqual(await node.chain.getPeerTransactionPool({ async request() { return response } }), [])
  }
  for (const response of ['not-json', '{}', '[1]']) {
    await assert.rejects(node.chain.getPeerTransactionPool({ async request() { return response } }))
  }
})

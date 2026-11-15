import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { TransactionMessage } from '@leofcoin/messages'
import { enqueueTransaction, PendingTransactionIndex } from '../../src/consensus/transaction-pool.ts'
import { resolveTransactionReference } from '../../src/consensus/transaction-reference.ts'
import { methods } from '../helpers/canonical-state-harness.js'

const production = methods('../../src/chain.ts', 'Chain', [
  '#sendTransaction', 'getPeerTransactionPool', '#peerConnected', '#connectRecoveredPeer'
])
const source = ts.transpile(`
  return class Harness {
    #participating = false
    #runningEpoch = false
    #pendingTransactionsRevision = 0
    pendingTransactions = new PendingTransactionIndex()
    #acceptingChainTraffic = true
    #peerHandshakes = new Map()
    loaded = true
    wantList = []
    machine = { states: {} }
    state = { sync: 'synced' }
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
    removePendingNonce() {}
    removePendingTransaction(hash) { this.pendingTransactions.remove(hash) }
    receive(transaction) { return this.#sendTransaction(transaction) }
    connect(id) { return this.#peerConnected(id) }
    recoveryComplete(value) { this.#acceptingChainTraffic = value; this.loaded = value }
    participate() { this.#participating = true }
    ${production}
  }
`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })

const createNode = () => {
  const pending = new Map()
  const canonical = new Map()
  const committed = new Map()
  const messages = []
  const logs = []
  const timers = []
  const neighbours = []
  const store = (map) => ({
    async has(hash) { return map.has(hash) },
    async get(hash) { return map.get(hash) },
    async put(hash, bytes) { map.set(hash, bytes) },
    async delete(hash) { map.delete(hash) },
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
    transactionStore: store(canonical),
    accountsStore: store(committed)
  }
  const Harness = new Function(
    'globalThis', 'peernet', 'TransactionMessage', 'enqueueTransaction', 'PendingTransactionIndex',
    'resolveTransactionReference', 'debug', 'setTimeout', 'resolveLastBlockMessage', 'console',
    source
  )(
    globals, peernet, TransactionMessage, enqueueTransaction, PendingTransactionIndex, resolveTransactionReference,
    (...args) => logs.push(args), callback => timers.push(callback),
    async decoded => ({ decoded }), { log() {}, error() {} }
  )
  return { chain: new Harness(), pending, canonical, committed, messages, logs, timers, neighbours, peernet, globals }
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

test('disconnects a peer once its accumulated failures exceed the reputation limit', async () => {
  const peer = { destroyed: 0, destroy() { this.destroyed++ } }
  const method = methods('../../src/chain.ts', 'Chain', ['#recordPeerFailure'])
  const code = ts.transpile(`return class {
    #peerReputations = new Map()
    #maxPeerFailures = 100
    #minPeerScore = -10
    fail(id) { return this.#recordPeerFailure(id, 'failure') }
    ${method}
  }`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })
  const Harness = new Function('globalThis', 'console', code)(
    { peernet: { connections: { peer } } }, { warn() {} }
  )
  const chain = new Harness()
  for (let count = 0; count < 10; count++) await chain.fail('peer')
  assert.equal(peer.destroyed, 0)
  await chain.fail('peer')
  assert.equal(peer.destroyed, 1)
})

test('a concurrent canonical commit cannot reintroduce a stale durable pool entry into the index', async () => {
  const node = createNode()
  const message = transaction()
  const hash = await message.hash()
  const put = node.globals.transactionPoolStore.put
  node.globals.transactionPoolStore.put = async (...args) => {
    await put(...args)
    node.committed.set('sender', new TextEncoder().encode('1'))
    node.chain.pendingTransactions.commit('sender', 1n)
  }
  assert.equal(await node.chain.receive(message), hash)
  assert.equal(node.pending.has(hash), false)
  assert.equal(node.chain.pendingTransactions.size, 0)
  assert.deepEqual(node.messages, [])
})

test('rejects a relayed transaction without a nonce before storing or broadcasting it', async () => {
  const node = createNode()
  await assert.rejects(node.chain.receive(transaction({ nonce: undefined })), /transaction nonce required/)
  assert.equal(node.pending.size, 0)
  assert.deepEqual(node.messages, [])
})

test('batch submission reports each post-admission failure and keeps its receipt', async () => {
  const methodsSource = methods('../../src/chain.ts', 'Chain', ['sendTransactions', '#assertRecoveryComplete'])
  const code = ts.transpile(`return class extends Base {
    #acceptingChainTraffic = true
    loaded = true
    async #sendTransaction(bytes) {
      if (new TransactionMessage(bytes).decoded.nonce === 2) throw new Error('index unavailable')
    }
    ${methodsSource}
  }`, { target: ts.ScriptTarget.ES2022 })
  class Base {
    async admitTransactions(messages) {
      return Promise.all(messages.map(async message => ({
        hash: await message.hash(), message, wait: Promise.resolve(), fee: 1n, data: undefined
      })))
    }
  }
  const sent = []
  const Harness = new Function('Base', 'TransactionMessage', 'globalThis', 'debug', code)(
    Base, TransactionMessage, { peernet: { async publish(topic, bytes) { sent.push([topic, bytes]) } } }, () => {}
  )
  const batch = [transaction({ nonce: 1 }).decoded, transaction({ nonce: 2 }).decoded,
    transaction({ nonce: 3 }).decoded]
  batch[0].hash = 'untrusted'
  const results = await new Harness().sendTransactions(batch)
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled'])
  assert.equal(results[1].reason.message, 'index unavailable')
  assert.equal(results[1].receipt.message.decoded.nonce, 2)
  assert.notEqual(results[0].value.hash, 'untrusted')
  assert.equal(sent.length, 2)
})

test('peer handshakes and pool catch-up stay disabled until recovery completes', async () => {
  const node = createNode()
  node.chain.recoveryComplete(false)
  await node.chain.connect('fixture-peer')
  assert.deepEqual(node.timers, [])
  assert.deepEqual(node.chain.synced, [])
  node.chain.recoveryComplete(true)
  await node.chain.connect('fixture-peer')
  assert.equal(node.timers.length, 1, 'ready peer can schedule pool catch-up')
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
  node.committed.set('sender', new TextEncoder().encode('1'))

  assert.equal(await node.chain.receive(message.encoded), hash)
  assert.equal(node.pending.size, 0)
  assert.deepEqual(node.messages, [])
  assert.deepEqual(node.chain.nonces, [])
})

test('reports committed nonce storage failures without broadcasting an invalid transaction', async () => {
  const node = createNode()
  node.globals.accountsStore.has = async () => { throw new Error('disk unavailable') }
  await assert.rejects(node.chain.receive(transaction().encoded), /transaction admission failed: disk unavailable/)
  assert.deepEqual(node.messages, [])
  assert.equal(node.pending.size, 0)
})

test('logs asynchronous relay failure but retains the accepted pool entry for recovery', async () => {
  const node = createNode()
  node.peernet.publish = async () => { throw new Error('disconnected') }
  const message = transaction()

  assert.equal(await node.chain.receive(message.encoded), await message.hash())
  assert.equal(node.pending.size, 1)
  assert.ok(node.logs.some(args => args.length === 1 && args[0].includes('disconnected')))
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

test('pool recovery uses locally available bodies and skips already committed or pending transactions', async () => {
  const browser = createNode()
  const validator = createNode()
  const message = transaction()
  const hash = await message.hash()
  browser.pending.set(hash, message.encoded)
  validator.neighbours.push(browser)
  validator.canonical.set(hash, message.encoded)
  validator.peernet.get = async () => { throw new Error('must use local body') }
  assert.deepEqual(await validator.chain.getPeerTransactionPool(validator.peernet.getConnection('browser')), [hash])
  assert.deepEqual(validator.pending.get(hash), message.encoded)
  assert.deepEqual(await validator.chain.getPeerTransactionPool(validator.peernet.getConnection('browser')), [])
  validator.pending.clear()
  validator.committed.set('sender', new TextEncoder().encode('1'))
  assert.deepEqual(await validator.chain.getPeerTransactionPool(validator.peernet.getConnection('browser')), [hash])
  assert.equal(validator.pending.size, 0)
})

test('pool recovery logs unavailable entries and continues', async () => {
  const node = createNode()
  const peer = { async request() { return ['missing'] } }

  assert.deepEqual(await node.chain.getPeerTransactionPool(peer), [])
  assert.ok(node.logs.some(args => args.join(' ').includes('pending transaction body unavailable')))
})

test('pool recovery rejects legacy JSON and malformed lists explicitly', async () => {
  const node = createNode()
  for (const response of ['[]', new TextEncoder().encode('[]')]) {
    await assert.rejects(node.chain.getPeerTransactionPool({ async request() { return response } }))
  }
  for (const response of ['not-json', '{}', '[1]']) {
    await assert.rejects(node.chain.getPeerTransactionPool({ async request() { return response } }))
  }
})

// Process-isolated recovery fixture: real genesis bytecodes, worker execution,
// signatures and LevelDB; no discovery, real wallet, home directory or network.
import assert from 'node:assert/strict'
import { ClassicLevel } from 'classic-level'
import Pubsub from '@vandeurenglenn/little-pubsub'
import MultiWallet from '@leofcoin/multi-wallet'
import addresses from '@leofcoin/addresses'
import bytecodes from '@leofcoin/lib/bytecodes.json' with { type: 'json' }
import { BlockMessage, ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { calculateFee, calculateMonetaryPolicy, distributeTransactionFee, signTransaction } from '@leofcoin/lib'
import { jsonStringifyBigInt } from '@leofcoin/utils'
import Machine from '../exports/machine.js'
import Chain from '../exports/chain.js'
import { CHECKPOINT_KEYS, readCheckpoint, writeCheckpoint } from '../exports/state-checkpoint.js'

const [root, mode, invalid] = process.argv.slice(2)
if (!root || !mode) throw new Error('Explicit temporary data root and mode required')
const db = new ClassicLevel(root, { valueEncoding: 'view' })
await db.open()
const store = name => ({
  has: async key => (await db.get(`${name}:${key}`)) !== undefined,
  get: key => db.get(`${name}:${key}`),
  put: (key, value) => db.put(`${name}:${key}`, typeof value === 'string' ? new TextEncoder().encode(value) : value),
  delete: key => db.del(`${name}:${key}`),
  keys: async () => (await db.keys({ gte: `${name}:`, lt: `${name};` }).all()).map(key => key.slice(name.length + 1)),
  clear: () => db.clear({ gte: `${name}:`, lt: `${name};` })
})
for (const name of ['state', 'chain', 'block', 'contract', 'transaction', 'transactionPool', 'accounts']) globalThis[`${name}Store`] = store(name)
globalThis.pubsub = new Pubsub()
const handlers = new Map()
const requestHandlers = new Map()
const network = 'leofcoin:peach'
globalThis.peernet = {
  network, peerId: 'recovery-fixture', peers: [], connections: {}, selectedAccount: 'fixture-observer',
  addRequestHandler: async (name, callback) => requestHandlers.set(name, callback), subscribe: (topic, callback) => handlers.set(topic, callback),
  get: (hash, name) => globalThis[`${name}Store`].get(hash),
  has: async hash => blockStore.has(hash),
  put: (hash, bytes, name) => globalThis[`${name}Store`].put(hash, bytes), publish: async () => {}
}
const required = [addresses.contractFactory, addresses.nativeToken, addresses.nameService, addresses.validators]
const { chainId } = await createChainIdentity(network, addresses)
const close = async machine => { machine?.close(); await db.close() }

const conflictingTarget = async () => {
  const block = new BlockMessage({
    index: 0n, previousHash: '0x0', timestamp: 999, reward: 0n, fees: 0n,
    transactions: [], validators: [], producer: 'conflict-fixture',
    producerProof: 'conflict-fixture', protocolVersion: '0.5.0'
  })
  const hash = await block.hash()
  await blockStore.put(hash, block.encoded)
  await chainStore.put('recoveryTarget', hash)
}
if (mode === 'set-target-conflict' || mode === 'set-target-missing') {
  if (mode === 'set-target-conflict') await conflictingTarget()
  else await chainStore.put('recoveryTarget', 'missing-recovery-block')
  await close()
  process.exit(0)
}

if (mode === 'prepare') {
  for (const encoded of Object.values(bytecodes)) {
    const message = new ContractMessage(Uint8Array.from(encoded.split(','), Number))
    await contractStore.put(await message.hash(), message.encoded)
  }
  const machine = new Machine()
  await machine.ready
  await machine.updateState(true)
  const checkpoint = await readCheckpoint(stateStore, chainId, required)
  if (invalid === 'deployment') {
    const definition = new ContractMessage({ creator: checkpoint.snapshot.states[addresses.nativeToken].creator,
      constructorParameters: [], contract: new TextEncoder().encode('return class Broken { constructor() { throw new Error("fixture deployment failure") } }') })
    const address = await definition.hash()
    await contractStore.put(address, definition.encoded)
    await assert.rejects(machine.execute(addresses.contractFactory, 'registerContract', [address]), /fixture deployment failure/)
    await assert.rejects(machine.get('missing-contract', 'state'), /Cannot read|not loaded/)
    assert.ok(BigInt(await machine.get(addresses.nativeToken, 'totalSupply')) > 0n, 'failed work must not poison subsequent worker reads')
    await close(machine)
    process.exit(0)
  }
  if (invalid === 'legacy-empty') {
    for (const key of CHECKPOINT_KEYS) await stateStore.delete(key)
    await stateStore.put('lastBlock', JSON.stringify({ index: -1, hash: '0x0' }))
    await stateStore.put('states', 'interrupted legacy snapshot')
    await stateStore.put('info', 'interrupted legacy counters')
    await accountsStore.put('uncommitted', '999')
    await chainStore.put('lastBlock', '0x0')
    await chainStore.put('version', '0.5.0')
    await db.put('fixture:sender', new TextEncoder().encode(checkpoint.snapshot.states[addresses.nativeToken].creator))
    await close(machine)
    process.exit(0)
  }
  const wallet = new MultiWallet(network)
  await wallet.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1), undefined, network)
  const sender = await wallet.address
  const recipient = 'recovery-fixture-recipient'
  const token = checkpoint.snapshot.states[addresses.nativeToken]
  // An explicitly synthetic, locally trusted checkpoint funds this fixture. It
  // does not replace or alter the real project's genesis or any user's identity.
  token.balances = { [sender]: BigInt(token.totalSupply) }
  token.holders = 1n
  const validators = checkpoint.snapshot.states[addresses.validators]
  validators.validators = [sender]
  validators.currentValidator = sender
  validators.validatorHistory = { 0: [sender] }
  if (invalid === 'stale-nonce') checkpoint.snapshot.accounts[sender] = '11167'
  const customContracts = []
  for (const initial of ['7', '11']) {
    const definition = new ContractMessage({ creator: sender, constructorParameters: [initial],
      contract: new TextEncoder().encode(`let reads = 0; return class Counter {
        constructor(initial, state) { this.value = BigInt(state?.value ?? initial) }
        get state() { return { value: this.value } }
        increment() { this.value += 1n; return this.value }
        get sneaky() { this.value += 1n; return this.value }
        mutateThenThrow() { this.value += 1n; throw new Error('fixture read failure') }
        async nestedRead(target) { return msg.staticCall(target, 'increment', []) }
        async nestedValue(target) { return msg.staticCall(target, 'value', []) }
        async nestedWrite(target) { return msg.call(target, 'increment', []) }
        async incrementFromRead(target) {
          this.value += 1n
          if (await msg.staticCall(msg.contract, 'value', []) !== this.value) throw new Error('stale in-flight read')
          if (await msg.staticCall(target, 'who', []) !== msg.contract) throw new Error('wrong nested caller')
          this.value += await msg.staticCall(target, 'value', [])
          return this.value
        }
        who() { return msg.sender }
        readCounter() { reads += 1; return reads }
        loop() { while (true) {} }
      }`) })
    const address = await definition.hash()
    await contractStore.put(address, definition.encoded)
    checkpoint.snapshot.states[address] = { value: BigInt(initial) }
    customContracts.push(address)
  }
  await db.put('fixture:custom', new TextEncoder().encode(JSON.stringify(customContracts)))
  if (invalid === 'contract') await contractStore.put(customContracts[0], await contractStore.get(addresses.nativeToken))
  await writeCheckpoint(stateStore, checkpoint.snapshot, 0, required)
  let supply = BigInt(token.totalSupply)
  let previousHash = '0x0'
  const transactionHashes = []
  for (let index = 0; index < 2; index++) {
    const timestamp = 1000 + index
    const nested = invalid === 'nested-static'
    const transaction = new TransactionMessage(await signTransaction({ from: sender, to: nested ? customContracts[0] : addresses.nativeToken,
      method: nested ? 'nestedRead' : 'transfer', params: nested ? [customContracts[1]] : [recipient, invalid === 'execution' ? supply + 1n : 100n], timestamp, nonce: index + 1 }, wallet))
    const hash = await transaction.hash()
    transactionHashes.push(hash)
    await transactionStore.put(hash, transaction.encoded)
    const fee = BigInt(await calculateFee(transaction.decoded))
    const policy = calculateMonetaryPolicy(supply, BigInt(token.targetSupply))
    const { payments, burned } = distributeTransactionFee(fee, hash, [sender], policy.burnBasisPoints)
    const earned = payments.reduce((sum, payment) => sum + payment.amount, 0n)
    const block = { index: BigInt(index), previousHash, timestamp, reward: policy.subsidy, fees: fee,
      transactions: [hash], validators: [{ address: sender, reward: policy.subsidy + earned }],
      producer: sender, producerProof: '', protocolVersion: '0.5.0' }
    const unsignedHash = await new BlockMessage(block).hash()
    block.producerProof = (await signTransaction({ from: sender, to: addresses.validators,
      method: 'produceBlock', params: [unsignedHash], timestamp }, wallet)).signature
    if (invalid === 'proof') block.producerProof = 'invalid'
    const message = new BlockMessage(block)
    previousHash = await message.hash()
    await blockStore.put(previousHash, message.encoded)
    supply += policy.subsidy - burned
  }
  await chainStore.put('lastBlock', previousHash)
  if (invalid === 'missing') await transactionStore.delete(transactionHashes[0])
  if (invalid === 'tampered') await transactionStore.put(transactionHashes[0], await transactionStore.get(transactionHashes[1]))
  if (invalid === 'no-anchor') {
    for (const key of CHECKPOINT_KEYS) await stateStore.delete(key)
    await chainStore.delete('lastBlock')
  }
  if (invalid === 'recovery-target-conflict') {
    await conflictingTarget()
  }
  await chainStore.put('version', '0.5.0')
  await db.put('fixture:sender', new TextEncoder().encode(sender))
  await close(machine)
  process.exit(0)
}

let triggered = false
let syncTarget
if (mode === 'sync-fork') {
  const hash = new TextDecoder().decode(await chainStore.get('lastBlock'))
  syncTarget = { ...new BlockMessage(await blockStore.get(hash)).decoded, hash }
  await chainStore.put('lastBlock', '0x0')
}
const recoveryTargetBefore = await chainStore.get('recoveryTarget')
const checkpointBefore = await readCheckpoint(stateStore, chainId, required)
const accountsBefore = await accountsStore.keys()
let recoveryTransportStarts = 0
let recoveredBodyHash
let earlyPeerHandshake
let earlyPeerHandshakeDone
if (mode === 'recover-peer-body' || mode === 'recover-peer-corrupt') {
  const { BinaryFormat, LastBlockMessage } = await import('@leofcoin/messages')
  const { Codec } = await import('@leofcoin/codec-format-interface')
  const { guardProviderDiscovery } = await import('../exports/connection-monitor.js')
  const proto = (name, schema) => class extends BinaryFormat {
    constructor(value) { super(value, schema, { name }) }
  }
  Object.assign(peernet, { id: 'recovery-fixture', stars: ['isolated-fixture-star'],
    protos: { 'peernet-dht': proto('peernet-dht', { hash: '', 'store?': '' }),
      'peernet-dht-response': proto('peernet-dht-response', { hash: '', has: false }),
      'peernet-data': proto('peernet-data', { hash: '', 'store?': '' }),
      'peernet-data-response': proto('peernet-data-response', { hash: '', data: new Uint8Array() }),
      'peernet-request': proto('peernet-request', { request: '' }),
      'peernet-response': proto('peernet-response', { response: undefined }) },
    prepareMessage: async message => ({ encoded: message.encoded }),
    handleData: async () => {}, sendMessage: async () => {}, requestData: async () => { throw new Error('unguarded request') },
    getConnection: id => peernet.connections[id],
    start: async () => {
      recoveryTransportStarts++
      for (const name of ['version', 'chainIdentity', 'lastBlock', 'knownBlocks', 'chainState'])
        assert.equal(typeof requestHandlers.get(name), 'function', `${name} must be available before connecting`)
      assert.equal(handlers.size, 0, 'no consensus, pool or block subscriptions before recovery')
    } })
  const bodyHashes = await transactionStore.keys()
  let firstBlock = new BlockMessage(await blockStore.get(new TextDecoder().decode(await chainStore.get('lastBlock'))))
  while (firstBlock.decoded.previousHash !== '0x0') firstBlock = new BlockMessage(await blockStore.get(firstBlock.decoded.previousHash))
  recoveredBodyHash = firstBlock.decoded.transactions[0]
  const body = await transactionStore.get(recoveredBodyHash)
  const other = await transactionStore.get(bodyHashes.find(hash => hash !== recoveredBodyHash))
  await transactionStore.delete(recoveredBodyHash)
  earlyPeerHandshakeDone = new Promise(resolve => { earlyPeerHandshake = resolve })
  const provider = { connected: true, request: async encoded => {
    const name = new Codec(encoded).name
    if (name === 'peernet-request') {
      assert.equal(chain.loaded, true, 'chain handshake must wait for successful recovery')
      const { request } = new peernet.protos[name](encoded).decoded
      if (request === 'version') return new peernet.protos['peernet-response']({ response: chain.version }).encoded
      assert.equal(request, 'lastBlock')
      earlyPeerHandshake()
      return new peernet.protos['peernet-response']({ response: new LastBlockMessage({ index: -1n, hash: '0x0', previousHash: '0x0' }).encoded }).encoded
    }
    const { hash, store } = new peernet.protos[name](encoded).decoded
    assert.equal(chain.loaded, false)
    assert.equal(handlers.has('consensus:propose'), false)
    assert.equal(handlers.has('send-transaction'), false)
    assert.equal(store, 'transaction')
    assert.equal(hash, recoveredBodyHash)
    if (name === 'peernet-dht') return new peernet.protos['peernet-dht-response']({ hash, has: true }).encoded
    return new peernet.protos['peernet-data-response']({ hash, data: mode === 'recover-peer-corrupt' ? other : body }).encoded
  } }
  peernet.get = async (hash, name) => {
    if (await globalThis[`${name}Store`].has(hash)) return globalThis[`${name}Store`].get(hash)
    assert.equal(recoveryTransportStarts, 1, 'transport must start before requesting a missing transaction')
    await assert.rejects(chain.sendTransaction({}), /recovery is not complete/)
    await assert.rejects(chain.participate('fixture-validator'), /recovery is not complete/)
    setTimeout(() => {
      peernet.connections.provider = provider
      pubsub.publish('peer:connected', 'provider')
    }, 25)
    return peernet.requestData(hash, name)
  }
  guardProviderDiscovery(peernet)
}
if (mode === 'recover-target-read-error') {
  const get = peernet.get
  peernet.get = async (hash, name) => {
    if (hash === 'missing-recovery-block') throw new Error('fixture recovery target read failure')
    return get(hash, name)
  }
}
if (mode.startsWith('crash-')) {
  const target = mode === 'crash-after-marker' ? chainStore : stateStore
  const put = target.put
  target.put = async (key, bytes) => {
    if (triggered || (target === stateStore ? !key.startsWith('checkpoint:') : key !== 'lastBlock')) return put(key, bytes)
    triggered = true
    if (target === stateStore) {
      assert.equal((await chain.lastBlock).hash, '0x0', 'an unapplied checkpoint must never be advertised')
      assert.equal(Number((await chain.machine.getCanonicalTip()).index), 0, 'crash occurs after real worker execution')
    }
    if (mode === 'crash-torn') await put(key, bytes.subarray(0, 40))
    else if (mode !== 'crash-before-checkpoint') await put(key, bytes)
    // Simulate abrupt termination, not an exception with graceful cleanup.
    process.exit(71)
  }
}
const chain = new Chain({})
try {
  await chain.ready
  if (mode === 'recover-peer-body') {
    assert.equal(recoveryTransportStarts, 1)
    assert.equal(await transactionStore.has(recoveredBodyHash), true, 'verified transaction is durable after replay')
    let timer
    try { await Promise.race([earlyPeerHandshakeDone, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('early peer was not handshaken after recovery')), 2000) })]) }
    finally { clearTimeout(timer) }
    console.log('RECOVERY_EARLY_TRANSPORT_OK')
  }
  assert.equal(chain.loaded, true)
  assert.equal(await chainStore.has('recoveryTarget'), false)
  if (mode === 'sync-fork') {
    assert.equal((await chain.lastBlock).hash, '0x0')
    peernet.peers = ['fixture-peer']
    peernet.connections = { fixture: { connected: true, version: chain.version } }
    const firstHash = syncTarget.previousHash
    const first = new BlockMessage(await blockStore.get(firstHash))
    assert.equal(await chain.syncChain({ ...first.decoded, hash: firstHash }), 'synced')
    const committed = await readCheckpoint(stateStore, chainId, required)
    const marker = await chainStore.get('lastBlock')
    await conflictingTarget()
    const forkParent = new TextDecoder().decode(await chainStore.get('recoveryTarget'))
    await chainStore.delete('recoveryTarget')
    const fork = new BlockMessage({ ...syncTarget, previousHash: forkParent })
    const forkHash = await fork.hash()
    await blockStore.put(forkHash, fork.encoded)
    assert.equal(await chain.syncChain({ ...fork.decoded, hash: forkHash }), 'errored')
    assert.deepEqual(await chainStore.get('lastBlock'), marker)
    assert.equal(await chainStore.has('recoveryTarget'), false)
    assert.deepEqual(await readCheckpoint(stateStore, chainId, required), committed)
    assert.equal(chain.loaded, true)
    assert.equal(await chain.syncChain(syncTarget), 'synced')
    assert.equal((await chain.lastBlock).hash, syncTarget.hash)
    assert.equal(await chainStore.has('recoveryTarget'), false)
    console.log('SYNC_FORK_REJECTED_WITHOUT_POISONING_RECOVERY')
  }
  const checkpoint = await readCheckpoint(stateStore, chainId, required)
  const sender = new TextDecoder().decode(await db.get('fixture:sender'))
  const customBytes = await db.get('fixture:custom')
  const customContracts = customBytes ? JSON.parse(new TextDecoder().decode(customBytes)) : []
  if (mode === 'queries') {
    const before = structuredClone(checkpoint.snapshot)
    const [first, second] = customContracts
    const counters = await chain.machine.totalTransactions
    assert.equal(await chain.staticCall(first, 'value'), 7n)
    assert.equal(await chain.staticCall(first, 'who'), 'leofcoin:read-only')
    assert.equal(await chain.staticCall(first, 'nestedValue', [second]), 11n)
    assert.equal(await chain.staticCall(first, 'readCounter', ['first context']), 1)
    assert.equal(await chain.staticCall(first, 'readCounter', ['second context']), 1)
    for (const [method, params, pattern] of [['increment', [], /Read-only call attempted/], ['sneaky', [], /Read-only call attempted/],
      ['mutateThenThrow', [], /fixture read failure/], ['nestedRead', [second], /Read-only call attempted/],
      ['nestedWrite', [second], /cannot call mutating/], ['loop', [], /deterministic limit/], ['constructor', [], /Invalid read-only/]])
      await assert.rejects(chain.staticCall(first, method, params), pattern)
    const alias = await chain.staticCall(first, 'state')
    alias.value = 999n
    assert.deepEqual(await chain.staticCall(first, 'state'), { value: 7n })
    assert.equal(await chain.staticCall(second, 'value'), 11n)
    assert.equal(await chain.machine.totalTransactions, counters)
    // Check the real canonical worker, not merely the read-worker's cached copy.
    await chain.machine.updateState(true)
    assert.deepEqual((await readCheckpoint(stateStore, chainId, required)).snapshot, before)
    await assert.rejects(chain.call(addresses.nativeToken, 'transfer', [sender, 1n]), /requires a signed transaction/)
    assert.throws(() => chain.internalCall(sender, addresses.nativeToken, 'transfer', [sender, 1n]), /impersonation is disabled/)
    await assert.rejects(chain.transfer(sender, sender, 1n), /requires a signed/)
    assert.throws(() => chain.mint(sender, 1n), /restricted to the monetary protocol/)
    assert.ok((await chain.lookup('LeofcoinToken')).address)
    const signer = new MultiWallet(network)
    await signer.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1), undefined, network)
    const signed = await signTransaction({ from: sender, to: first, method: 'incrementFromRead', params: [second], nonce: 3, timestamp: 2000 }, signer)
    await assert.rejects(chain.call({ ...signed, signature: 'invalid' }), /signature/)
    const pending = await chain.call({ ...signed, hash: 'caller-supplied-hash-must-be-ignored' })
    assert.equal(pending.hash, await new TransactionMessage(signed).hash())
    assert.equal(await transactionPoolStore.has(pending.hash), true)
    assert.equal(await chain.staticCall(first, 'value'), 7n, 'a signed call queues a transaction; it does not directly execute it')
    assert.equal(await chain.machine.totalTransactions, counters)
    const body = new TransactionMessage(signed)
    // A proposer makes the canonical transaction body available before gossiping its block.
    await transactionStore.put(await body.hash(), body.encoded)
    const fee = BigInt(await calculateFee(body.decoded))
    const policy = calculateMonetaryPolicy(BigInt(before.states[addresses.nativeToken].totalSupply), BigInt(before.states[addresses.nativeToken].targetSupply))
    const earned = distributeTransactionFee(fee, await body.hash(), [sender], policy.burnBasisPoints).payments.reduce((sum, payment) => sum + payment.amount, 0n)
    const block = { index: 2n, previousHash: before.lastBlock.hash, timestamp: 2000, fees: fee, reward: policy.subsidy,
      transactions: [pending.hash], validators: [{ address: sender, reward: policy.subsidy + earned }],
      producer: sender, producerProof: '', protocolVersion: '0.5.0' }
    block.producerProof = (await signTransaction({ from: sender, to: addresses.validators, method: 'produceBlock',
      params: [await new BlockMessage(block).hash()], timestamp: block.timestamp }, signer)).signature
    await handlers.get('add-block')(new BlockMessage(block).encoded)
    assert.equal(await chain.staticCall(first, 'value'), 19n, 'a committed transaction invalidates the old read cache')
    assert.equal(await transactionPoolStore.has(pending.hash), false)
    assert.equal((await readCheckpoint(stateStore, chainId, required)).snapshot.states[first].value, 19n)
    console.log('READ_ISOLATION_OK')
    await close(chain.machine)
    process.exit(0)
  }
  const result = { tip: await chain.lastBlock, token: checkpoint.snapshot.states[addresses.nativeToken],
    accounts: checkpoint.snapshot.accounts, info: checkpoint.snapshot.info,
    custom: await Promise.all(customContracts.map(async address => ({ state: checkpoint.snapshot.states[address],
      value: await chain.staticCall(address, 'value') }))),
    recipient: await chain.staticCall(addresses.nativeToken, 'balanceOf', ['recovery-fixture-recipient']),
    sender: await chain.staticCall(addresses.nativeToken, 'balanceOf', [sender]) }
  console.log('RECOVERED', JSON.stringify(result, jsonStringifyBigInt))
  await close(chain.machine)
  process.exit(0)
} catch (error) {
  if (mode === 'recover-peer-corrupt') {
    assert.equal(chain.loaded, false)
    assert.equal(await transactionStore.has(recoveredBodyHash), false)
    assert.deepEqual(await readCheckpoint(stateStore, chainId, required), checkpointBefore)
    assert.equal(handlers.has('consensus:propose'), false)
    assert.equal(handlers.has('send-transaction'), false)
  }
  if (invalid === 'preserve-target') {
    assert.deepEqual(await chainStore.get('recoveryTarget'), recoveryTargetBefore)
    assert.deepEqual(await readCheckpoint(stateStore, chainId, required), checkpointBefore)
    assert.deepEqual(await accountsStore.keys(), accountsBefore)
  }
  console.error('RECOVERY_REJECTED', error?.message ?? error)
  await close(chain.machine)
  process.exit(42)
}

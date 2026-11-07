// Shared instrumentation for both unmodified runtimes. Never patch consensus or skip validation.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { inspect } from 'node:util'
import { encodeWire, decodeWire } from '@leofcoin/binary'

const runtime = resolve(process.env.LEOFCOIN_BENCH_RUNTIME || '')
const dataRoot = resolve(process.env.LEOFCOIN_BENCH_DATA || '')
const fromTemp = relative(tmpdir(), dataRoot)
if (!process.env.LEOFCOIN_BENCH_DATA || !fromTemp || fromTemp.startsWith('..') || isAbsolute(fromTemp))
  throw new Error('Benchmark requires an explicit private temporary root')
const star = new URL(process.env.LEOFCOIN_BENCH_STAR)
if (star.protocol !== 'ws:' || star.hostname !== '127.0.0.1') throw new Error('Benchmark discovery must be loopback-only')
const manifest = name => readFile(join(runtime, 'node_modules', name, 'package.json'), 'utf8').then(JSON.parse)
async function packageFile(name, subpath = '.') {
  const json = await manifest(name)
  let entry = json.exports?.[subpath]
  if (!entry && subpath === '.' && typeof json.exports === 'string') entry = json.exports
  if (!entry && subpath === '.') entry = json.module || json.main
  if (entry && typeof entry === 'object') entry = entry.import || entry.default
  if (typeof entry !== 'string' || !entry.startsWith('./')) throw new Error(`Unsupported benchmark export: ${name}/${subpath}`)
  return join(runtime, 'node_modules', name, entry)
}
const load = async (name, subpath) => import(pathToFileURL(await packageFile(name, subpath)).href)
const send = value => process.send?.(encodeWire('chain-benchmark', value))
const events = []
let chain, initial, tracked = [], crashTopic
const blockedTopics = new Set()
const { default: Node } = await load('@leofcoin/chain', './node')
const { default: addresses } = await load('@leofcoin/addresses')
const { BlockMessage, ContractMessage, TransactionMessage, ProposalMessage } = await load('@leofcoin/messages')
const lib = await load('@leofcoin/lib')
const utils = await load('@leofcoin/utils')
const { default: MultiWallet } = await load('@leofcoin/multi-wallet')
const { createChainIdentity } = await load('@leofcoin/lib', './chain-identity')
const definitions = JSON.parse(await readFile(await packageFile('@leofcoin/lib', './bytecodes.json'), 'utf8'))
const chainPackage = await manifest('@leofcoin/chain')
const protocol = chainPackage.version === '1.10.22' ? '0.4.0' : '0.5.0'
const network = 'leofcoin:e2e'
const node = new Node({ network, networkVersion: 'e2e', root: relative(homedir(), dataRoot), stars: [star.href], autoStart: false,
  transport: { kind: 'webrtc', kinds: ['webrtc'], fallback: { enabled: false, order: ['webrtc'] }, webrtc: { backend: 'vandeurenglenn' } }
}, 'benchmark-test-only')
await node.ready
// Test-only faults at real message boundaries; never bypass quorum/validation.
const peer = globalThis.peernet
const publish = peer.publish.bind(peer), subscribe = peer.subscribe.bind(peer)
peer.publish = (topic, ...args) => {
  if (blockedTopics.has(topic)) return
  if (topic === 'consensus:propose') send({ type: 'proposal', ...new ProposalMessage(args[0]).decoded })
  if (crashTopic === topic) {
    crashTopic = undefined
    process.send(encodeWire('chain-benchmark', { type: 'injected-crash', topic }), () => process.exit(86))
    return
  }
  return publish(topic, ...args)
}
peer.subscribe = (topic, callback, ...rest) => subscribe(topic, (...args) => {
  if (!blockedTopics.has(topic)) return callback(...args)
}, ...rest)
for (const name of ['chain', 'state', 'accounts', 'wallet', 'account', 'contract', 'block', 'transaction', 'transactionPool']) {
  const store = globalThis[`${name}Store`]
  if (store && resolve(store.db?.root || '') !== dataRoot) throw new Error(`Store escaped benchmark root: ${name}`)
}
const chainDirectory = join(runtime, 'node_modules/@leofcoin/chain/exports')
const { default: Chain } = await load('@leofcoin/chain', './chain')
const required = [addresses.contractFactory, addresses.nativeToken, addresses.nameService, addresses.validators]
const identity = await createChainIdentity(network, addresses)
const recipientWallet = new MultiWallet(network)
await recipientWallet.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => 200 - index), undefined, network)
const recipient = await recipientWallet.address
const closeMachine = async machine => {
  const worker = machine.worker?.worker
  const stopped = worker?.exitCode == null ? new Promise(resolve => worker.once('exit', resolve)) : Promise.resolve()
  if (machine.close) machine.close(); else machine.worker.terminate()
  await stopped
}
const logJSON = value => JSON.stringify(value, utils.jsonStringifyBigInt)

// The published bundle has no standalone Machine export. Bootstrap its original
// worker through its original IPC protocol; this adapter is fixture setup only.
async function freshMachine() {
  if (protocol === '0.5.0') {
    const { default: Machine } = await import(pathToFileURL(join(chainDirectory, 'machine.js')).href)
    const machine = new Machine()
    await machine.ready
    return machine
  }
  const { default: EasyWorker } = await load('@vandeurenglenn/easy-worker')
  const worker = await new EasyWorker(join(chainDirectory, 'workers/machine-worker.js'), { serialization: 'advanced', type: 'module' })
  const pending = new Map()
  let sequence = 0
  const ready = new Promise((resolve, reject) => {
    worker.onmessage(async message => {
      if (message.type === 'ask') {
        try {
          if (message.question === 'peers') { worker.postMessage({ id: message.id, input: [] }); return }
          assert.equal(message.question, 'contract')
          worker.postMessage({ id: message.id, input: await globalThis.contractStore.get(message.input) })
        } catch (error) { worker.postMessage({ id: message.id, error: error.message }); reject(error) }
      } else if (message.type === 'machine-ready') resolve()
      else if (message.type === 'initError' || message.type === 'contractError') reject(new Error(message.message || message.error || 'Fixture initialization failed'))
      else if (message.type === 'response' && pending.has(message.id)) {
        pending.get(message.id)(message.value); pending.delete(message.id)
      }
    })
  })
  worker.postMessage({ type: 'init', input: { blocks: [], fromState: false, peerid: globalThis.peernet.peerId } })
  await ready
  return { worker, get: (contract, method, params) => new Promise(resolve => {
    const id = `fixture-${++sequence}`
    pending.set(id, resolve); worker.postMessage({ type: 'get', id, input: { contract, method, params } })
  }) }
}

async function seed(input) {
  assert.equal(await globalThis.chainStore.has('lastBlock'), false, 'Benchmark only seeds a fresh private store')
  for (const value of Object.values(definitions)) {
    const message = new ContractMessage(Uint8Array.from(value.split(','), Number))
    await globalThis.contractStore.put(await message.hash(), message.encoded)
  }
  if (!input?.anchor) {
    const machine = await freshMachine()
    const states = {}
    for (const address of required) states[address] = await machine.get(address, 'state', [])
    await closeMachine(machine)
    const account = globalThis.peernet.selectedAccount
    const members = [...new Set(input?.members || [account])].sort()
    assert(members.includes(account), 'Seed creator must be a fixture validator')
    const token = states[addresses.nativeToken], validators = states[addresses.validators]
    const stake = BigInt(validators.minimumBalance)
    token.balances = { [account]: BigInt(token.totalSupply) - stake * BigInt(members.length), [addresses.validators]: stake * BigInt(members.length) }
    token.holders = 2n
    validators.validators = members; validators.currentValidator = account
    validators.balances = Object.fromEntries(members.map(member => [member, stake])); validators.validatorHistory = { 0: members }
    const anchor = { index: 0n, previousHash: '0x0', timestamp: 1000, reward: 0n, fees: 0n,
      transactions: [], validators: members.map(address => ({ address, reward: 0n })), producer: account, producerProof: '', protocolVersion: protocol }
    anchor.producerProof = (await lib.signTransaction({ from: account, to: addresses.validators, method: 'produceBlock',
      params: [await new BlockMessage(anchor).hash()], timestamp: anchor.timestamp }, globalThis.peernet.identity)).signature
    const message = new BlockMessage(anchor), hash = await message.hash()
    input = { chainId: identity.chainId, states, accounts: {}, lastBlock: { ...message.decoded, hash, loaded: true },
      info: { nativeCalls: 0n, nativeMints: 0n, nativeBurns: 0n, nativeTransfers: 0n,
        totalBurnAmount: 0n, totalMintAmount: 0n, totalTransferAmount: 0n, totalTransactions: 0n, totalBlocks: 1n },
      anchor: message.encoded, account, recipient }
  }
  assert.equal(input.chainId, identity.chainId)
  assert.equal(await new BlockMessage(input.anchor).hash(), input.lastBlock.hash)
  await globalThis.blockStore.put(input.lastBlock.hash, input.anchor)
  await globalThis.chainStore.put('version', protocol)
  await globalThis.chainStore.put('lastBlock', input.lastBlock.hash)
  if (protocol === '0.5.0') {
    const { writeCheckpoint } = await import(pathToFileURL(join(chainDirectory, 'state-checkpoint.js')).href)
    await writeCheckpoint(globalThis.stateStore, input, 0, required)
  } else {
    for (const [key, value] of Object.entries({ lastBlock: input.lastBlock, states: input.states, accounts: input.accounts, info: input.info }))
      await globalThis.stateStore.put(key, logJSON(value))
  }
  initial = input
  return input
}

if (process.env.LEOFCOIN_BENCH_OBSERVER_FAULTS === '1') {
  // Register before the fixture reporter and transaction waiters: a broken UI
  // must neither halt canonical work nor hide its commit from later observers.
  for (const topic of ['lastBlock', 'block-resolved', 'sync-progress', 'block-loaded', 'transaction-processed', 'block-processed']) {
    globalThis.pubsub.subscribe(topic, () => { throw new Error(`injected sync observer failure: ${topic}`) })
    globalThis.pubsub.subscribe(topic, async () => { throw new Error(`injected async observer failure: ${topic}`) })
  }
}
globalThis.pubsub.subscribe('block-processed', block => {
  const event = { type: 'block', index: Number(block.index), hash: block.hash,
    transactions: block.transactions, at: performance.now() }
  events.push(event)
  if (events.length > 128) events.shift()
  send(event)
})
async function status() {
  const tip = chain ? await chain.lastBlock : initial?.lastBlock
  return { account: globalThis.peernet.selectedAccount, peerId: globalThis.peernet.peerId, pid: process.pid, protocol, version: chainPackage.version,
    tip: tip && { index: Number(tip.index), hash: tip.hash }, state: chain?.state,
    pending: await globalThis.transactionPoolStore.keys(),
    peers: Object.values(globalThis.peernet.connections || {}).filter(peer => peer.connected).length,
    main: { cpu: process.cpuUsage(), memory: process.memoryUsage() } }
}
async function audit() {
  const state = await chain.staticCall(addresses.nativeToken, 'state', [])
  const nonce = await globalThis.accountsStore.has(initial.account)
    ? BigInt(new TextDecoder().decode(await globalThis.accountsStore.get(initial.account))) : 0n
  const tip = await chain.lastBlock
  const block = new BlockMessage(await globalThis.blockStore.get(tip.hash))
  const sum = Object.values(state.balances).reduce((total, value) => total + BigInt(value), 0n)
  return { ...await status(), recipientBalance: BigInt(state.balances[initial.recipient] || 0), nonce,
    totalTransactions: BigInt(await chain.totalTransactions), nativeTransfers: BigInt(await chain.nativeTransfers),
    supply: BigInt(state.totalSupply), balanceSum: sum, transactions: block.decoded.transactions }
}
let tail = Promise.resolve()
process.on('message', bytes => {
  tail = tail.then(async () => {
    const request = decodeWire('chain-benchmark', bytes)
    try {
      let value
      if (request.action === 'seed') value = await seed(request.input)
      else if (request.action === 'restore') {
        assert.equal(await globalThis.chainStore.has('lastBlock'), true)
        assert.equal(typeof request.input.account, 'string'); assert.equal(typeof request.input.recipient, 'string')
        initial = request.input; value = true
      }
      else if (request.action === 'start') { chain = new Chain({ network, networkVersion: 'e2e' }); await chain.ready; value = await status() }
      else if (request.action === 'status') value = await status()
      else if (request.action === 'prepare') {
        const start = await chain.getNonce(initial.account)
        tracked = []
        for (let index = 0; index < request.input; index++) tracked.push(await lib.signTransaction({
          from: initial.account, to: addresses.nativeToken, method: 'transfer', params: [initial.recipient, 100n],
          timestamp: Date.now(), nonce: Number(start) + index + 1
        }, globalThis.peernet.identity))
        value = tracked
      } else if (request.action === 'submit') {
        value = []
        for (const transaction of request.input) {
          const pending = await chain.sendTransaction(transaction)
          pending.wait?.catch?.(() => {})
          value.push(pending.hash)
        }
      } else if (request.action === 'participate') value = await chain.participate(globalThis.peernet.selectedAccount)
      else if (request.action === 'partition') {
        blockedTopics.clear()
        const topics = request.input === 'precommit-only' ? ['consensus:precommit']
          : request.input ? ['consensus:propose', 'consensus:prevote', 'consensus:precommit', 'add-block'] : []
        for (const topic of topics) blockedTopics.add(topic)
        value = true
      }
      else if (request.action === 'crash-on-precommit') { crashTopic = 'consensus:precommit'; value = true }
      else if (request.action === 'history') {
        value = []
        let hash = (await chain.lastBlock).hash
        while (hash !== '0x0') {
          const block = new BlockMessage(await globalThis.blockStore.get(hash))
          assert.equal(await block.hash(), hash)
          value.push({ hash, ...block.decoded })
          hash = block.decoded.previousHash
        }
        value.reverse()
      }
      else if (request.action === 'audit') value = await audit()
      else if (request.action === 'shutdown') {
        if (chain?.machine) await closeMachine(chain.machine)
        send({ id: request.id, value: true }); setImmediate(() => process.exit(0)); return
      }
      else throw new Error('Unknown benchmark action')
      send({ id: request.id, value })
    } catch (error) { send({ id: request.id, error: inspect(error, { depth: 6 }), stack: error?.stack }) }
  }).catch(error => { send({ type: 'fatal', error: error.message, stack: error.stack }); process.exitCode = 1 })
})
for (const event of ['uncaughtException', 'unhandledRejection']) process.on(event, error => {
  send({ type: 'fatal', error: inspect(error, { depth: 8 }), stack: error?.stack }); process.exit(1)
})
send({ type: 'node-ready', ...await status() })

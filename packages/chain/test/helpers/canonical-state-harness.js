import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { distributeAmount } from '@leofcoin/lib'
import { CanonicalStateQueue } from '../../src/consensus/canonical-state-queue.ts'
import { validateChainLink } from '../../src/consensus/chain-link.ts'

// Exercise the actual private application methods without starting discovery,
// using a real wallet, or opening any persistent stores. Authentication and
// serialization are accepted-message boundaries here, not consensus fixtures.
export const methods = (file, className, names) => {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8')
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className)
  return names.map(name => {
    const method = declaration.members.find(member => member.name?.getText(ast) === name)
    assert.ok(method, `Missing production method ${className}.${name}`)
    return method.getText(ast)
  }).join('\n')
}
const applicationMethods = methods('../../src/chain.ts', 'Chain', [
  '#addBlock', '#applyBlock', '#executeTransaction', '#handleTransaction'
])
const stateMethods = methods('../../src/state.ts', 'State', [
  'withCanonicalState', 'canonicalTip', 'syncChain', '#syncChain', '#loadBlocks', '#_executeTransaction'
])

export const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

export const createApplicationHarness = (options = {}) => {
  const events = []
  const counts = { executions: 0, fees: 0, rewards: 0, loaded: 0, snapshots: 0, stores: 0 }
  const balances = { sender: 1000n, recipient: 0n, validator: 0n }
  let tip = { index: 570, hash: 'parent' }
  const transactions = new Set()
  const policy = { subsidy: 100n, burnBasisPoints: 0n }
  const transaction = {
    decoded: { from: 'sender', to: 'token', method: 'transfer', params: ['recipient', 100n], nonce: 1n },
    encoded: Uint8Array.of(2),
    async hash() { return 'tx' },
    async encode() { return this.encoded }
  }
  class AcceptedBlockMessage {
    constructor(block = {}) {
      this.decoded = Object.freeze({
        index: 571n, previousHash: 'parent', timestamp: 1000, protocolVersion: '0.4.0',
        fees: 10n, validators: [{ address: 'validator' }], transactions: Object.freeze(['tx']),
        ...(block.decoded ?? block)
      })
      this.identity = block.identity ?? 'block'
      this.encoded = Uint8Array.of(1)
    }
    async hash() { return this.identity }
  }
  const machine = {
    async getCanonicalTip() {
      if (options.tipFailure) throw new Error('tip read timed out')
      return { ...tip }
    },
    async collectFee() {
      counts.fees++
      balances.sender -= 10n
      balances.validator += 10n
    },
    async execute(contract, method) {
      counts.executions++
      await options.execute?.()
      if (options.executionFailure) throw new Error('execution failed')
      balances.sender -= 100n
      balances.recipient += 100n
      return true
    },
    async settleRewards() {
      counts.rewards++
      balances.validator += 100n
      if (options.rewardFailure) throw new Error('reward acknowledgement lost')
    },
    async addLoadedBlock(block) {
      counts.loaded++
      tip = { index: Number(block.index), hash: block.hash }
      events.push('loaded')
      return true
    },
    async get() { return 0n }
  }
  const pool = { async has() { return false }, async delete() {}, async keys() { return [] } }
  const transactionStore = {
    async has(hash) { return transactions.has(hash) },
    async put(hash) { transactions.add(hash) }
  }
  Object.assign(globalThis, {
    blockStore: { async put() { counts.stores++ } },
    transactionPoolStore: pool,
    accountsStore: { async put() {} },
    peernet: { selectedAccount: 'other', peers: ['peer'], async publish() {} },
    pubsub: { publish() {} },
    chainStore: { async get() { return new TextEncoder().encode(tip.hash) } }
  })
  const source = `class Harness {
    #canonicalStateQueue = new CanonicalStateQueue()
    #blocks = []
    #machine = boundary.machine
    #chainState = 'loaded'
    #loaded = true
    #chainSyncing = false
    #syncState = 'synced'
    #syncErrorCount = 0
    #lastBlockInQue
    jobber = { busy: false }
    wantList = []
    get shouldSync() { return !this.#chainSyncing }
    get machine() { return this.#machine }
    removePendingNonce() {}
    async validateTransactionSignature() {}
    async #validateBlockValidators() { await boundary.validate() }
    async #resolveBlockTransactions() { return [boundary.transaction] }
    async #loadBlockTransactions() { return [boundary.transaction] }
    async #monetaryPolicy() { return boundary.policy }
    async #handleEpochBoundary() {}
    async call() {}
    async updateState() { boundary.snapshot() }
    add(block) { return this.#addBlock(block) }
    async #getLatestBlock() { return boundary.loadedBlock() }
    async #resolveTransactions() {}
    async resolveBlock() {
      const block = boundary.loadedBlock()
      this.#blocks[block.index] = block
    }
    sync(block = boundary.loadedBlock()) { return this.syncChain(block) }
    ${applicationMethods}
    ${stateMethods}
  }`
  const bindings = {
    boundary: {
      machine, transaction, policy,
      loadedBlock: () => ({ ...block.decoded, hash: block.identity, loaded: false }),
      async validate() { if (options.invalid) throw new Error('invalid block') },
      snapshot() {
        if (options.snapshotFailure) throw new Error('snapshot write failed')
        counts.snapshots++
        events.push('snapshot')
      }
    },
    CanonicalStateQueue, validateChainLink, BlockMessage: AcceptedBlockMessage,
    transactionStore, transactionPoolStore: pool, peernet: globalThis.peernet,
    console: { log() {}, error() {} }, debug: message => events.push(message),
    compareTransactionNonces: () => 0, supportsTransactionFees: () => true,
    supportsMonetaryPolicy: () => true, calculateFee: async () => 10n,
    distributeTransactionFee: () => ({ payments: [{ to: 'validator', amount: 10n }], burned: 0n }),
    distributeAmount, calculateMonetaryPolicy: () => policy,
    validateBlockResourceLimits: async () => {}, nativeToken: 'token',
    isExecutionError: () => true, addresses: { validators: 'validators' }
  }
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText
  const Harness = new Function(...Object.keys(bindings), `${js}; return Harness`)(...Object.values(bindings))
  const instance = new Harness()
  const block = new AcceptedBlockMessage()
  return {
    instance, block, counts, balances, events, options,
    fork: () => Object.assign(new AcceptedBlockMessage(), { identity: 'fork' }),
    loadedBlock: () => ({ ...block.decoded, hash: block.identity, loaded: false })
  }
}

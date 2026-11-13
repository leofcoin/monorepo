import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'
import { TransactionMessage } from '@leofcoin/messages'
import { MAX_BLOCK_TRANSACTIONS, MAX_BLOCK_TRANSACTION_BYTES, MAX_TRANSACTION_BYTES } from '@leofcoin/lib'
import {
  PendingTransactionIndex, pruneCanonicalTransactions, compareExecutionTransactions
} from '../packages/chain/src/consensus/transaction-pool.ts'
import { resolveTransactionReference } from '../packages/chain/src/consensus/transaction-reference.ts'

const reference = process.argv[2] || 'HEAD'
const commit = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`], { encoding: 'utf8' }).trim()
const previous = execFileSync('git', ['show', `${commit}:packages/chain/src/chain.ts`], { encoding: 'utf8' })
const current = await readFile(new URL('../packages/chain/src/chain.ts', import.meta.url), 'utf8')
if (!previous.includes('globalThis.transactionPoolStore.values()'))
  throw new Error('Select a baseline commit that still uses full-pool proposal scans')

function selector(text, store, index) {
  const ast = ts.createSourceFile('chain.ts', text, ts.ScriptTarget.Latest, true)
  const chain = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Chain')
  const method = chain.members.find(node => node.name?.getText(ast) === '#createBlock')
  const statements = method.body.statements
  const end = statements.findIndex(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'localBlock'))
  assert.ok(end > 0, 'proposal selection boundary must be present')
  const body = statements.slice(0, end).map(node => node.getText(ast)).join('\n')
  const js = ts.transpileModule(`return new class {
    #proposalInFlight = null
    version = '0.6.0'
    pendingTransactions = index
    machine = { latestTransactions: async () => [] }
    async promiseTransactions(values) { return values.map(value => new TransactionMessage(value)) }
    async validateTransactionSignature() {}
    removePendingNonce() {}
    removePendingTransaction(hash) { this.pendingTransactions.remove(hash) }
    async select() { ${body}; return block.transactions }
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const globals = {
    transactionPoolStore: store,
    accountsStore: { async has() { return false } },
    peernet: { async put() {} }
  }
  return new Function('globalThis', 'index', 'TransactionMessage', 'resolveTransactionReference',
    'pruneCanonicalTransactions', 'compareExecutionTransactions', 'MAX_BLOCK_TRANSACTIONS',
    'MAX_BLOCK_TRANSACTION_BYTES', 'MAX_TRANSACTION_BYTES', 'supportsTransactionFees', 'calculateFee', js)(
    globals, index, TransactionMessage, resolveTransactionReference, pruneCanonicalTransactions,
    compareExecutionTransactions, MAX_BLOCK_TRANSACTIONS, MAX_BLOCK_TRANSACTION_BYTES, MAX_TRANSACTION_BYTES,
    () => false, async () => 0n
  )
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const results = []
for (const count of [10_000, 100_000]) {
  const entries = []
  for (let nonce = 1; nonce <= count; nonce++) {
    const transaction = new TransactionMessage({
      from: 'sender', to: 'token', method: 'transfer', params: ['recipient', 1n],
      nonce, timestamp: 1000, signature: 'selection-only-fixture'
    })
    entries.push([await transaction.hash(), transaction.encoded])
  }
  entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  const bodies = new Map(entries)
  let reads = 0, scans = 0
  const store = {
    async size() { return count },
    async values() { scans++; return [...bodies.values()] },
    async get(hash) { reads++; return bodies.get(hash) },
    async delete() { throw new Error('Fixture must not prune or mutate the pool') }
  }
  const index = new PendingTransactionIndex()
  const startup = performance.now()
  for (const bytes of bodies.values()) {
    const transaction = new TransactionMessage(bytes)
    index.add(await transaction.hash(), transaction, 0n)
  }
  const indexBuildMs = performance.now() - startup
  const before = selector(previous, store, index), after = selector(current, store, index)
  const timings = { before: [], after: [] }, operations = { before: [], after: [] }
  let expected
  for (let sample = 0; sample < 3; sample++) {
    for (const label of sample % 2 ? ['after', 'before'] : ['before', 'after']) {
      globalThis.gc?.()
      reads = 0; scans = 0
      const start = performance.now()
      const selected = await (label === 'before' ? before : after).select()
      timings[label].push(performance.now() - start)
      operations[label].push({ bodyReads: reads, fullScans: scans })
      assert.equal(selected.length, 256)
      if (expected) assert.deepEqual(selected, expected)
      else expected = selected
    }
  }
  const result = {
    pendingTransactions: count, selectedTransactions: expected.length, indexBuildMs,
    beforeMedianMs: median(timings.before), afterMedianMs: median(timings.after), timings, operations
  }
  results.push(result)
  console.log(JSON.stringify(result))
}
const report = {
  baselineCommit: commit, node: process.version, measuredAt: new Date().toISOString(),
  workload: 'Actual proposal-selection source, one sender, hash-ordered in-memory bodies; no disk I/O, signatures, execution or consensus',
  results
}
const output = new URL('../node_modules/.cache/pool-selection-comparison.json', import.meta.url)
await mkdir(new URL('.', output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2))

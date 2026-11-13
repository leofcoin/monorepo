import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { encodeValue, decodeValue } from '@leofcoin/binary'

// Test the production worker dispatch handler without creating a native worker.
const text = readFileSync(new URL('../src/machine-worker.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('machine-worker.ts', text, ts.ScriptTarget.Latest, true)
const dispatch = ast.statements.find(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(decl => decl.name.getText(ast) === '_'))
const initializer = dispatch.declarationList.declarations[0].initializer
const handler = initializer.properties.find(property => property.name?.getText(ast) === 'addLoadedBlock')
const js = ts.transpileModule(`const add = ${handler.initializer.getText(ast)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText
const createRegistry = new Function(`
  let blocks = [], totalBlocks = 0n
  let lastBlock = { index: -1, hash: '0x0' }
  const worker = { postMessage() {} }
  const formatBytes = value => value
  const encodeValue = () => new Uint8Array()
  ${js}
  return { add: block => add(block), count: () => totalBlocks, tip: () => lastBlock }
`)

test('loaded block registration is idempotent and never increments counters for duplicates', () => {
  const registry = createRegistry()
  const genesis = { index: 0, hash: 'genesis', previousHash: '0x0' }
  assert.equal(registry.add(genesis), true)
  assert.equal(registry.add(genesis), false)
  assert.equal(registry.count(), 1n)
  assert.equal(registry.add({ index: 1, hash: 'next', previousHash: 'genesis' }), true)
  assert.equal(registry.add(genesis), false)
  assert.equal(registry.count(), 2n)
  assert.equal(registry.tip().hash, 'next')
})

test('loaded block registration rejects conflicting blocks, gaps and incorrect parents', () => {
  const registry = createRegistry()
  registry.add({ index: 0, hash: 'genesis', previousHash: '0x0' })
  assert.throws(() => registry.add({ index: 0, hash: 'fork', previousHash: '0x0' }), /conflict/)
  assert.throws(() => registry.add({ index: 2, hash: 'gap', previousHash: 'genesis' }), /canonical tip/)
  assert.throws(() => registry.add({ index: 1, hash: 'wrong', previousHash: 'other' }), /canonical tip/)
  assert.throws(() => registry.add({ index: NaN, hash: 'invalid' }), /Invalid loaded/)
  assert.equal(registry.count(), 1n)
  assert.equal(registry.tip().hash, 'genesis')
})

const executeHandler = initializer.properties.find(property => property.name?.getText(ast) === 'executeTransactions')
const executeJS = ts.transpileModule(`return ${executeHandler.initializer.getText(ast)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText
const executeBatch = (operations, readOnly = false) => new Function('_', 'readOnly', 'MAX_BLOCK_TRANSACTIONS', executeJS)(
  operations, readOnly, 256
)
const execution = hash => ({
  hash, from: 'sender', to: 'token', method: 'transfer', params: ['recipient', 1n], timestamp: 1000,
  feePayments: { payments: [{ to: 'validator', amount: 10n }], burned: 1n }
})

test('worker batches preserve fee/call ordering and bind each call to its original execution context', async () => {
  const calls = []
  const run = executeBatch({
    async collectFee(value) { calls.push(['fee', value]) },
    async execute(value) { calls.push(['call', value]) }
  })
  assert.equal(await run([execution('one'), execution('two')]), true)
  assert.deepEqual(calls.map(([type]) => type), ['fee', 'call', 'fee', 'call'])
  assert.deepEqual(calls.filter(([type]) => type === 'call').map(([, value]) => [
    value.executionSeed, value.executionTimestamp, value.sender, value.contract, value.params
  ]), [
    ['one', 1000, 'sender', 'token', ['recipient', 1n]],
    ['two', 1000, 'sender', 'token', ['recipient', 1n]]
  ])
})

test('worker batches stop at the failing transaction and reject read-only or oversized work', async () => {
  const calls = []
  const run = executeBatch({
    async collectFee() {},
    async execute(value) {
      calls.push(value.executionSeed)
      if (value.executionSeed === 'two') throw new Error('contract failure')
    }
  })
  await assert.rejects(run([execution('one'), execution('two'), execution('three')]),
    error => error.transactionHash === 'two' && /Transaction two execution failed/.test(error.message))
  assert.deepEqual(calls, ['one', 'two'])
  await assert.rejects(run(Array.from({ length: 257 }, () => execution('many'))), /Invalid transaction execution batch/)
  await assert.rejects(executeBatch({}, true)([execution('readonly')]), /Read-only worker/)
})

test('worker task errors retain the failing transaction hash across binary IPC', async () => {
  const declaration = ast.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(decl => decl.name.getText(ast) === 'runTask'))
  const source = ts.transpileModule(`return ${declaration.declarationList.declarations[0].initializer.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText
  const messages = []
  const run = new Function('_', 'worker', 'respond', source)(
    { executeTransactions: executeBatch({
      async collectFee() {},
      async execute() { throw new Error('contract failure') }
    }) },
    { postMessage(message) { messages.push(decodeValue(encodeValue(message))) } },
    () => assert.fail('a failed batch must not receive a success acknowledgement')
  )
  await run('request', 'executeTransactions', [execution('failed')])
  assert.deepEqual(messages, [{
    type: 'executeTransactionsError', id: 'request', transactionHash: 'failed',
    message: 'Transaction failed execution failed: contract failure'
  }])
})

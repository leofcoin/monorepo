import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

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
  const jsonParseBigInt = undefined
  ${js}
  return { add: block => add(JSON.stringify(block)), count: () => totalBlocks, tip: () => lastBlock }
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

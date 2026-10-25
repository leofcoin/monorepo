import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transform } from 'esbuild'
import * as planner from '@leofcoin/lib/genesis-plan'
import { checkChainPresence } from '../dist/presence.js'
import { generateGenesisBundle } from '../dist/genesis.js'

// Run the actual component logic with inert rendering/decorators. No browser,
// wallet, node or database is needed for this controller-boundary test.
const source = readFileSync(new URL('../src/manager.ts', import.meta.url), 'utf8')
const body = source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '').replace(/export class/, 'class')
const { code } = await transform(body, { loader: 'ts', target: 'es2022', tsconfigRaw: {
  compilerOptions: { experimentalDecorators: false, useDefineForClassFields: true }
} })
const decorator = () => () => undefined
const bindings = {
  ...planner, checkChainPresence, generateGenesisBundle, LitElement: class {}, customElement: () => value => value,
  property: decorator, state: decorator, css: () => '', html: () => ''
}
const Manager = new Function(...Object.keys(bindings), `${code}; return ManagerView`)(...Object.values(bindings))
const address = 'YTqyQkkaMKMTShz7LQh8XdxdZ2GPsXkd1bYHpqQWEF7tQyABZ9DGb'
const fixture = () => {
  const manager = new Manager()
  manager.owner = address
  manager.initial = '100'
  manager.target = '1000'
  manager.stars = ''
  return manager
}
// Private handlers stay private in production; bind them through real render
// event attributes without relying on copied implementation code.
const handlers = (instance, overrides = {}) => {
  const captured = []
  const templates = []
  const collecting = { ...bindings, ...overrides, html: (strings, ...values) => { captured.push(...values); templates.push({strings,values}); return '' } }
  const CollectingManager = new Function(...Object.keys(collecting), `${code}; return ManagerView`)(...Object.values(collecting))
  const manager = new CollectingManager()
  Object.assign(manager, instance)
  // Lit's reactive accessors do not enumerate like ordinary fields in this harness.
  for (const key of ['step','owner','initial','target','stars','label','distribute','allocations','plan','fingerprint','acknowledged'])
    manager[key] = instance[key]
  const find = label => {
    captured.length = 0
    templates.length = 0
    // Render callbacks are collected in template order. Main action is last.
    manager.render()
    const functions = captured.filter(value => typeof value === 'function')
    if (label === 'next' || label === 'download') return functions.at(-1)
    if (label === 'import') return functions.at(-2)
    if (label === 'presence') {
      const template = templates.find(template => template.strings.join('').includes('Already announced?'))
      return template?.values[template.strings.findIndex(value => value.endsWith('@click='))]
    }
    if (label === 'generate') {
      const template = templates.find(template => template.strings.join('').includes('Generate genesis bundle'))
      return template?.values[template.strings.findIndex((value, index) =>
        value.endsWith('@click=') && template.strings[index + 1]?.includes('Generate genesis bundle'))]
    }
    throw new Error('Unknown handler')
  }
  return { manager, find }
}

test('wizard validates before advancing and never exports an unreviewed draft', async () => {
  const { manager, find } = handlers(fixture())
  await find('next')()
  assert.equal(manager.step, 1)
  await find('next')()
  assert.equal(manager.step, 2)
  assert.equal(manager.plan.genesisValidator, address)
  assert.equal(manager.plan.allocations[0].amount, '100')
  assert.match(manager.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(manager.acknowledged, false)
  // Guard returns before touching any browser download API.
  find('download')()
  assert.equal(manager.notice, '')
})

test('network check remains unknown offline and reports endpoint results', async () => {
  const checked = []
  const {manager,find} = handlers(fixture(), {
    checkChainPresence: async (endpoint, chainId) => {
      checked.push({ endpoint, chainId })
      return { status: endpoint ? 'found' : 'unknown' }
    }
  })
  await find('next')()
  await find('next')()
  await find('presence')()
  assert.equal(manager.presence.status, 'unknown')
  manager.endpoint = 'http://localhost:3030'
  await find('presence')()
  assert.equal(manager.presence.status, 'found')
  assert.deepEqual(checked.at(-1), { endpoint: manager.endpoint, chainId: manager.plan.chainId })
})

test('invalid supply keeps the wizard at entry and clears its busy state', async () => {
  const initial = fixture()
  initial.initial = '1001'
  const { manager, find } = handlers(initial)
  await find('next')()
  assert.equal(manager.step, 0)
  assert.match(manager.error, /not exceed/)
  assert.equal(manager.busy, false)
  assert.equal(manager.plan, undefined)
})

test('invalid split cannot reach review', async () => {
  const { manager, find } = handlers(fixture())
  await find('next')()
  manager.distribute = true
  manager.allocations = [{ address, amount: '99' }]
  await find('next')()
  assert.equal(manager.step, 1)
  assert.match(manager.error, /must equal/)
})

test('reviewed downloads contain the exact public plan and release the object URL', async () => {
  const clicked = []
  const revoked = []
  let blob
  const { manager, find } = handlers(fixture(), {
    URL: { createObjectURL: value => { blob = value; return 'blob:unit-test' }, revokeObjectURL: value => revoked.push(value) },
    document: { createElement: () => ({ click() { clicked.push([this.href, this.download]) } }) },
    setTimeout: callback => callback()
  })
  await find('next')()
  await find('next')()
  manager.acknowledged = true
  find('download')()
  assert.deepEqual(clicked, [['blob:unit-test', 'leofcoin-genesis-plan.json']])
  assert.deepEqual(revoked, ['blob:unit-test'])
  assert.equal(await blob.text(), planner.serializeGenesisPlan(manager.plan))
  assert.match(manager.notice, /No genesis, account, tokens or chain state were created/)
})

test('imports validate public schema, reset consent and reject secret-bearing JSON', async () => {
  const original = handlers(fixture())
  await original.find('next')()
  await original.find('next')()
  const { manager, find } = handlers(fixture())
  manager.acknowledged = true
  const file = { size: 1000, text: async () => planner.serializeGenesisPlan(original.manager.plan) }
  await find('import')({ target: { files: [file], value: 'plan.json' } })
  assert.equal(manager.step, 2)
  assert.equal(manager.fingerprint, original.manager.fingerprint)
  assert.equal(manager.acknowledged, false)
  const bad = handlers(fixture())
  await bad.find('import')({ target: { files: [{ size: 1000, text: async () => JSON.stringify({
    ...original.manager.plan, password: 'unit-test-only'
  }) }], value: 'bad.json' } })
  assert.equal(bad.manager.step, 0)
  assert.match(bad.manager.error, /Never include secrets/)
  assert.equal(bad.manager.plan, undefined)
})

test('failed endpoint checks show an explicit error without blocking offline export', async () => {
  const { manager, find } = handlers(fixture(), {
    checkChainPresence: async () => { throw new Error('Endpoint unavailable') }
  })
  await find('next')()
  await find('next')()
  await find('presence')()
  assert.equal(manager.presence.status, 'unknown')
  assert.equal(manager.error, 'Endpoint unavailable')
  assert.equal(manager.checking, false)
  assert.ok(manager.plan)
})

test('genesis generation requires review consent and downloads actual bytecodes', async () => {
  let blob
  const downloads = []
  const { manager, find } = handlers(fixture(), {
    URL: { createObjectURL: value => { blob = value; return 'blob:genesis' }, revokeObjectURL: () => {} },
    document: { createElement: () => ({ click() { downloads.push(this.download) } }) },
    setTimeout: callback => callback()
  })
  await find('next')()
  await find('next')()
  await find('generate')()
  assert.equal(downloads.length, 0)
  manager.acknowledged = true
  await find('generate')()
  assert.equal(manager.error, '')
  assert.deepEqual(downloads, ['leofcoin-genesis-bundle.json'])
  const bundle = JSON.parse(await blob.text())
  assert.equal(bundle.identity.chainId, manager.plan.chainId)
  assert.equal(Object.keys(bundle.bytecodes).length, 4)
  assert.equal(manager.busy, false)
})

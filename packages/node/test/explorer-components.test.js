import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
import Pubsub from '@vandeurenglenn/little-pubsub'
import { explorerFixture } from './explorer-fixture-data.js'

const data = await explorerFixture('fixture-public-address')
const helpers = new URL('../src/controllers/explorer-data.js', import.meta.url).href
const rankings = new URL('../src/controllers/explorer-rankings.js', import.meta.url).href
const publicExplorer = new URL('../src/controllers/public-explorer.js', import.meta.url).href
const search = new URL('../src/controllers/explorer-search.js', import.meta.url).href

async function component(file) {
  const source = (await readFile(new URL(file, import.meta.url), 'utf8')).replace(/^import[\s\S]*?from ['"][^'"]+['"]\n/gm, '')
  const prefix = `
    import { PAGE_SIZE, readBlockPage, transactionReferences, readTransactionRows, readPoolReferences, explorerLink,
      shortId, nativeMovement, formatLfc, compactLfc, readTransaction, boundedRead, stringify } from ${JSON.stringify(helpers)};
    import { rankActivity, rankHolders, formatRankingBalance } from ${JSON.stringify(rankings)};
    import { getExplorerSource } from ${JSON.stringify(publicExplorer)};
    import { resolveExplorerSearch } from ${JSON.stringify(search)};
    const getSelectedNetwork = () => ({ label: 'Peach' });
    const property = () => () => undefined; const state = property; const customElement = () => value => value;
    const ledgerStyles = ''; const html = (strings, ...values) => ({ strings: [...strings], values });
    class LitElement extends EventTarget {
      shadowRoot = { querySelector: () => null }; hasUpdated = false;
      connectedCallback() {} disconnectedCallback() {}
    }
    const LiteElement = LitElement; const css = html; const svg = html;
    class HTMLElement {}
    const customElements = { get: () => true, define() {} };
  `
  const result = await transform(prefix + source, { loader: 'ts', format: 'esm', target: 'es2022' })
  return import(`data:text/javascript;base64,${Buffer.from(result.code).toString('base64')}`)
}

test('explorer exposes one automatic search field and its form routes both hash types', async t => {
  runtime(t)
  const previousLocation = globalThis.location
  t.after(() => { previousLocation === undefined ? delete globalThis.location : globalThis.location = previousLocation })
  globalThis.location = { hash: '' }
  const { ExplorerView } = await component('../src/views/explorer.ts')
  const view = new ExplorerView()
  view.viewWithOrWithoutHistory = () => ''
  const rendered = view.render()
  const output = text(rendered)
  assert.doesNotMatch(output, /<select|Explorer search type/)
  assert.match(output, /Block index, block hash or transaction hash/)
  const submit = rendered.values.find(value => typeof value === 'function')
  for (const [hash, kind] of [[data.blocks[0].hash, 'block'], [data.blocks[0].transactions[0], 'transaction']]) {
    view.searchQuery = hash
    await submit({ preventDefault() {} })
    assert.equal(location.hash, `#!/explorer/${kind}?selected=${hash}`)
    assert.equal(view.searching, false)
    assert.equal(view.searchError, '')
  }
  view.searchQuery = 'not-a-hash'
  await submit({ preventDefault() {} })
  assert.match(view.searchError, /Enter a block index/)
})

function runtime(t) {
  const keys = ['chain', 'transactionStore', 'transactionPoolStore', 'peernet', 'pubsub']
  const original = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  t.after(() => { for (const key of keys) original[key] === undefined ? delete globalThis[key] : globalThis[key] = original[key] })
  Object.assign(globalThis, { chain: { nativeToken: data.nativeToken, lastBlock: data.blocks.at(-1),
    getBlocks: async (from, to) => data.blocks.slice(from, to) }, transactionStore: data.transactionStore,
    transactionPoolStore: data.transactionPoolStore, pubsub: new Pubsub(true) })
}

test('transaction pagination reuses an unchanged block page; the pool never reads chain blocks', async t => {
  runtime(t)
  const { ExplorerLedgerList } = await component('../src/elements/explorer/ledger-list.ts')
  let reads = 0
  chain.getBlocks = async (from, to) => { reads++; return data.blocks.slice(from, to) }
  const list = new (class extends ExplorerLedgerList { get mode() { return 'transactions' } })()
  await list.load(true)
  assert.equal(reads, 1)
  assert.equal(list.rows.length, 25)
  assert.equal(list.references.length, 50)
  const first = list.rows[0].hash
  list.offset = 25
  await list.load()
  assert.equal(reads, 1)
  assert.notEqual(list.rows[0].hash, first)
  const pool = new (class extends ExplorerLedgerList { get mode() { return 'pool' } })()
  await pool.load(true)
  assert.equal(reads, 1)
  assert.equal(pool.rows.length, 1)
  assert.equal(pool.rows[0].transaction.nonce, 999)
  assert.equal(pool.rows[0].blockIndex, undefined)
})

test('hidden list views unsubscribe and reject a late snapshot', async t => {
  runtime(t)
  const { ExplorerLedgerList } = await component('../src/elements/explorer/ledger-list.ts')
  let release
  chain.getBlocks = () => new Promise(resolve => { release = resolve })
  const list = new ExplorerLedgerList()
  list.connectedCallback()
  for (let attempt = 0; !release && attempt < 50; attempt++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(pubsub.subscriberCount('block-loaded'), 1)
  list.disconnectedCallback()
  assert.equal(pubsub.subscriberCount('block-loaded'), 0)
  assert.equal(pubsub.subscriberCount('node:ready'), 0)
  release(data.blocks.slice(40, 65))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(list.rows.length, 0)
  assert.equal(list.loading, false)
})

test('transaction detail does not infer confirmation from storage or a URL parameter', async t => {
  runtime(t)
  const { ExplorerTransaction } = await component('../src/views/explorer/explorer-transaction.ts')
  const detail = new ExplorerTransaction()
  detail.selected = data.blocks[64].transactions[0]
  await detail.load()
  assert.equal(detail.status, 'Inclusion not checked')
  detail.blockIndex = '64'; detail.blockHash = data.blocks[64].hash
  await detail.load()
  assert.equal(detail.status, 'Recorded in local chain')
  detail.blockHash = 'wrong-hash'
  await detail.load()
  assert.equal(detail.inclusion, undefined)
  assert.equal(detail.status, 'Not found in the requested local block')
  detail.blockIndex = ''; detail.blockHash = ''
  detail.selected = (await data.transactionPoolStore.keys())[0]
  await detail.load()
  assert.equal(detail.status, 'Pending in local pool')
  assert.equal(detail.inclusion, undefined)
})

function text(template) {
  if (Array.isArray(template)) return template.map(text).join('')
  if (template?.strings) return template.strings.map((part, index) => part + text(template.values[index])).join('')
  return template === undefined || template === null || typeof template === 'function' ? '' : String(template)
}

test('overview does not label an unknown registry liveness or throughput as zero', async () => {
  const { ExplorerDashboardCharts } = await component('../src/elements/explorer/dashboard-charts.ts')
  const charts = new ExplorerDashboardCharts()
  charts.totalValidators = 4
  let output = text(charts.render())
  assert.match(output, /4 registered/)
  assert.match(output, /Online status is not available/)
  assert.match(output, /throughput not measured/)
  assert.doesNotMatch(output, /4 offline/)
  charts.onlineValidators = 2
  output = text(charts.render())
  assert.match(output, /2 of 4 validators online/)
})

test('unresolved activity metadata is unavailable, not a zero-activity ranking', async () => {
  const { DashboardRankings } = await component('../src/elements/explorer/dashboard-rankings.ts')
  const ranks = new DashboardRankings()
  ranks.activityError = 'Transaction bodies are unresolved.'
  const output = text(ranks.render())
  assert.match(output, /Activity sample unavailable/)
  assert.match(output, /Transaction bodies are unresolved/)
  assert.doesNotMatch(output, /No contract calls in this sample/)
  assert.doesNotMatch(output, /No sent transactions in this sample/)
})

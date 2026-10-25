import assert from 'node:assert/strict'
import test from 'node:test'
import { ManagerReceipts } from '../exports/manager-receipts.js'

const hash = 'A'.repeat(52)
const receipt = () => ({ hash, status: 'pending', createdAt: Date.now(), startHeight: 1 })
function fixture() {
  const data = new Map()
  const store = { has: async key => data.has(key), get: async key => data.get(key), put: async (key, value) => data.set(key, value) }
  const blocks = Array.from({ length: 301 }, (_, index) => ({ index, hash: `block-${index}`, transactions: [] }))
  const reads = []
  const chain = {
    lastBlock: blocks[300],
    getBlocks: async (from, to) => { reads.push([from, to]); return blocks.slice(from, to) }
  }
  return { journal: new ManagerReceipts(() => store, chain), chain, blocks, reads, data, store }
}

test('receipt data is chain-namespaced and malformed storage is not overwritten', async () => {
  const { journal, data } = fixture()
  await journal.save('chain-a', new Map([[hash, receipt()]]))
  assert.equal((await journal.load('chain-a')).size, 1)
  assert.equal((await journal.load('chain-b')).size, 0)
  const key = 'manager:receipts:v1:chain-a'
  data.set(key, new TextEncoder().encode('[{"hash":"invalid"}]'))
  const before = data.get(key)
  await assert.rejects(journal.load('chain-a'), /invalid/)
  assert.equal(data.get(key), before)
})

test('persisted scan anchor changes restart the bounded scan rather than skip a reorged inclusion', async () => {
  const { journal, blocks, reads } = fixture()
  const first = await journal.reconcile(receipt())
  assert.equal(first.scannedHeight, 128)
  assert.equal(reads.length, 128)
  blocks[128] = { ...blocks[128], hash: 'replacement-anchor' }
  blocks[10] = { ...blocks[10], transactions: [hash] }
  const next = await journal.reconcile(first)
  assert.equal(next.status, 'confirmed')
  assert.equal(next.blockHeight, 10)
})

test('missing blocks and a changing tip fail explicitly without success-shaped reconciliation', async () => {
  const { journal, chain, blocks } = fixture()
  chain.getBlocks = async () => []
  await assert.rejects(journal.reconcile(receipt()), /unavailable/)
  chain.getBlocks = async (from, to) => {
    chain.lastBlock = { ...blocks[300], hash: 'changed-tip' }
    return blocks.slice(from, to)
  }
  await assert.rejects(journal.reconcile(receipt()), /tip changed/)
})

test('strict canonical tip failures do not fall back to cached chain state', async () => {
  const { journal, chain } = fixture()
  chain.machine = { getCanonicalTip: async () => { throw new Error('worker unavailable') } }
  await assert.rejects(journal.reconcile(receipt()), /worker unavailable/)
})

test('unresolved capacity never evicts a reservation and completion capacity evicts only completed entries', () => {
  const { journal } = fixture()
  const entries = new Map(Array.from({ length: 512 }, (_, index) => [`entry-${index}`, receipt()]))
  assert.throws(() => journal.reserve(entries, receipt()), /capacity/)
  assert.equal(entries.size, 512)
  entries.get('entry-20').status = 'failed'
  journal.reserve(entries, receipt())
  assert.equal(entries.size, 512)
  assert.equal(entries.has('entry-20'), false)
  assert.equal(entries.has('entry-0'), true)
})

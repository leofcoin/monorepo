import assert from 'node:assert/strict'
import test from 'node:test'
import { explorerFixture } from './explorer-fixture-data.js'
import { CodecHash } from '@leofcoin/codec-format-interface'
import { parseExplorerSearch, resolveExplorerSearch } from '../src/controllers/explorer-search.js'
import { readBlockPage, readBlockContent, readPoolReferences, transactionReferences, readTransactionRows,
  readTransaction, safeHeight, formatLfc, compactLfc, nativeMovement, mapReads, boundedRead, explorerLink } from '../src/controllers/explorer-data.js'

const fixture = await explorerFixture('fixture-public-address')
const chain = { lastBlock: fixture.blocks.at(-1), getBlocks: async (from, to) => fixture.blocks.slice(from, to) }

test('unified search recognizes exact decimal indices, including BigInt notation', () => {
  for (const input of ['0', ' 00012 ', '12n', 12n, 12])
    assert.deepEqual(parseExplorerSearch(input), { kind: 'index', index: input === '0' ? 0n : 12n })
  assert.equal(parseExplorerSearch('9007199254740993123456789').index, 9007199254740993123456789n)
  for (const input of ['', '-1', '1.5', '1e3', '0x10', '+12', '12 n', Number.MAX_SAFE_INTEGER + 1, '1'.repeat(161)])
    assert.throws(() => parseExplorerSearch(input), /Enter a block index/)
})

test('unified search decodes block and transaction codecs instead of guessing text prefixes', async () => {
  const blockHash = fixture.blocks[0].hash
  const transactionHash = fixture.blocks[0].transactions[0]
  assert.deepEqual(parseExplorerSearch(blockHash), { kind: 'block', hash: blockHash })
  assert.deepEqual(parseExplorerSearch(` ${transactionHash.toLowerCase()} `), { kind: 'transaction', hash: transactionHash })
  const unrelated = new CodecHash({ name: 'contract-message' })
  await unrelated.encode(new Uint8Array([1, 2, 3]))
  const short = new CodecHash()
  short.fromBs32(blockHash)
  const bytes = short.buffer.slice(0, -1)
  bytes[short.prefix.length - 1] = 31
  short.encoded = bytes
  for (const input of [blockHash.slice(0, -1), `${blockHash}A`, short.toBs32(), unrelated.toBs32(), 'A'.repeat(58)])
    assert.throws(() => parseExplorerSearch(input), /complete block hash/)
  assert.throws(() => parseExplorerSearch(`A${blockHash}`), /complete block hash/)
})

test('hash search routes directly without fetching or probing both content types', async () => {
  const noSource = () => { throw new Error('Hash routing must not read a source') }
  assert.equal(await resolveExplorerSearch(fixture.blocks[0].hash, noSource), explorerLink('block', { selected: fixture.blocks[0].hash }))
  const hash = fixture.blocks[0].transactions[0]
  assert.equal(await resolveExplorerSearch(hash, noSource), explorerLink('transaction', { selected: hash }))
  await assert.rejects(resolveExplorerSearch('not-a-hash', noSource), /Enter a block index/)
  await assert.rejects(resolveExplorerSearch('9007199254740993123456789', noSource), /#9007199254740993123456789 is outside/)
  await assert.rejects(resolveExplorerSearch(String(Number.MAX_SAFE_INTEGER), noSource), /outside the index range/)
})

test('index search reads one exact block, includes genesis and rejects missing or unloaded entries', async () => {
  const reads = []
  const source = async () => ({ chain: { getBlocks: async (from, to) => { reads.push([from, to]); return fixture.blocks.slice(from, to) } } })
  assert.equal(await resolveExplorerSearch('0n', source), explorerLink('block', { selected: fixture.blocks[0].hash, index: '0' }))
  assert.equal(await resolveExplorerSearch('12', source), explorerLink('block', { selected: fixture.blocks[12].hash, index: '12' }))
  assert.deepEqual(reads, [[0, 1], [12, 13]])
  await assert.rejects(resolveExplorerSearch('65', source), /#65 is not available/)
  await assert.rejects(resolveExplorerSearch('0', async () => ({ chain: { getBlocks: async () => [{ ...fixture.blocks[0], loaded: false }] } })), /not available/)
  await assert.rejects(resolveExplorerSearch('0', async () => ({ chain: { getBlocks: async () => [{ ...fixture.blocks[0], hash: fixture.blocks[0].transactions[0] }] } })), /invalid block hash/)
})

test('canonical block pages are bounded, descending, zero-based and include genesis', async () => {
  const newest = await readBlockPage(chain)
  assert.equal(newest.blocks.length, 25)
  assert.deepEqual([newest.start, newest.end, newest.missing], [40, 64, 0])
  assert.equal(newest.blocks[0].index, 64)
  const oldest = await readBlockPage(chain, 14)
  assert.deepEqual(oldest.blocks.map(block => block.index), Array.from({ length: 15 }, (_, index) => 14 - index))
  const genesis = await readBlockPage(chain, 0)
  assert.equal(genesis.blocks[0].index, 0)
  assert.equal((await readBlockPage({ ...chain, lastBlock: { index: -1 } })).blocks.length, 0)
  await assert.rejects(readBlockPage({ ...chain, lastBlock: { index: undefined } }), /unavailable/)
})

test('missing blocks and duplicate entries are not fabricated or counted twice', async () => {
  const page = await readBlockPage({ ...chain, getBlocks: async () => [fixture.blocks[64], fixture.blocks[64], fixture.blocks[63], null] })
  assert.equal(page.missing, 23)
  assert.equal(page.blocks.length, 2)
  await assert.rejects(readBlockPage({ ...chain, getBlocks: async () => false }), /invalid block page/)
  assert.throws(() => safeHeight('0'), /unavailable/)
  assert.throws(() => safeHeight(2n ** 63n), /Invalid/)
})

test('transactions keep actual block identities, not height-as-array-offset lookups', async () => {
  const blocks = [fixture.blocks[64], fixture.blocks[50]]
  const refs = transactionReferences(blocks)
  assert.equal(refs[0].blockIndex, 64)
  assert.equal(refs[0].blockHash, fixture.blocks[64].hash)
  assert.equal(refs.at(-1).blockIndex, 50)
  const rows = await readTransactionRows(refs, fixture)
  assert.ok(rows.every(row => row.transaction && row.size > 0 && !row.error))
  const missing = await readTransactionRows([{ hash: 'missing', blockHash: 'block', blockIndex: 64 }], fixture)
  assert.match(missing[0].error, /not available/)
  assert.equal(missing[0].blockIndex, 64)
  const wrong = await readTransactionRows([{ hash: 'wrong', input: rows[0].transaction }], fixture)
  assert.match(wrong[0].error, /does not match/)
})

test('pool reads use the pool store and are capped independently of confirmed transactions', async () => {
  const result = await readPoolReferences(fixture.transactionPoolStore)
  assert.equal(result.references.length, 1)
  const pending = await readTransaction(result.references[0], fixture)
  assert.equal(pending.transaction.nonce, 999)
  assert.equal(pending.blockIndex, undefined)
  const capped = await readPoolReferences({ keys: async () => Array.from({ length: 150 }, (_, index) => `pending-${index}`) })
  assert.equal(capped.references.length, 100)
  assert.equal(capped.truncated, true)
})

test('native movement uses the current transfer ABI and never guesses other token decimals', () => {
  assert.equal(nativeMovement({ to: 'other', method: 'transfer', params: ['receiver', '100'] }, fixture.nativeToken), null)
  assert.equal(nativeMovement({ to: fixture.nativeToken, method: 'transfer', params: ['receiver', '100'] }, fixture.nativeToken).units, '100')
  assert.equal(nativeMovement({ to: fixture.nativeToken, method: 'transferFrom', params: ['sender', 'receiver', '150'] }, fixture.nativeToken).units, '150')
  assert.equal(nativeMovement({ to: fixture.nativeToken, method: 'transfer', params: ['receiver', '1.5'] }, fixture.nativeToken), null)
  assert.equal(formatLfc(1n), '0.000000000000000001')
  assert.equal(compactLfc(1n), '<0.000001')
  assert.equal(formatLfc(10n ** 18n + 1n), '1.000000000000000001')
  assert.equal(formatLfc(9007199254740993123456789012345678n), '9,007,199,254,740,993.123456789012345678')
  assert.equal(formatLfc(Number.MAX_SAFE_INTEGER + 1), '—')
})

test('block and transaction content hashes are checked before display', async () => {
  const block = fixture.blocks.at(-1)
  const result = await readBlockContent(block.hash, { get: async () => fixture.blockBytes.get(block.hash) })
  assert.equal(Number(result.index), 64)
  await assert.rejects(readBlockContent('wrong', { get: async () => fixture.blockBytes.get(block.hash) }), /does not match/)
  await assert.rejects(readBlockContent(block.hash, { get: async () => undefined }), /not found/)
  assert.equal(explorerLink('transaction', { selected: 'a&b' }), '#!/explorer/transaction?selected=a%26b')
})

test('read concurrency is bounded and timeouts surface a useful error', async () => {
  let active = 0
  let maximum = 0
  const result = await mapReads(Array.from({ length: 20 }, (_, i) => i), async value => {
    active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setImmediate(resolve))
    active--; return value
  })
  assert.equal(maximum, 4)
  assert.deepEqual(result, Array.from({ length: 20 }, (_, i) => i))
  await assert.rejects(boundedRead(() => new Promise(() => {}), 5), /did not respond/)
})

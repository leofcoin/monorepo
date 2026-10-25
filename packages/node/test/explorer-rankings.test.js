import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRankingBalance, rankActivity, rankHolders } from '../src/controllers/explorer-rankings.js'

test('formats holder balances without floating point precision loss', () => {
  assert.equal(formatRankingBalance(5000226027397260273972572n), '5,000,226.0273…')
  assert.equal(formatRankingBalance(2000000000000000000n), '2')
  assert.equal(formatRankingBalance(1n), '0…')
  assert.equal(formatRankingBalance(123456789012345678901234000000000000n), '123,456,789,012,345,678.9012…')
})

test('caps recent activity to the latest 128 unique blocks regardless of storage result order', () => {
  const blocks = Array.from({ length: 594 }, (_, index) => ({ index, transactions: [] }))
  const result = rankActivity([...blocks].reverse().concat(blocks[593]))
  assert.equal(result.blocks, 128)
  assert.equal(result.start, 466)
  assert.equal(result.end, 593)
})

test('ranks current balances with exact bigint ordering, zero exclusion and deterministic ties', () => {
  const result = rankHolders({
    whale: '9007199254740993000000000000000000',
    runnerUp: '9007199254740992999999999999999999',
    z: '3', a: 3n, empty: 0n
  }, 3)
  assert.equal(result.total, 4)
  assert.deepEqual(result.holders.map((holder) => holder.address), ['whale', 'runnerUp', 'a'])
  assert.equal(result.holders[0].balance, 9007199254740993000000000000000000n)
  assert.ok(result.holders[0].share >= 49.99 && result.holders[0].share <= 50)
  assert.throws(() => rankHolders({ a: '-1' }), /Invalid holder balance/)
  assert.throws(() => rankHolders({ a: Number.MAX_SAFE_INTEGER + 1 }), /Invalid holder balance/)
  assert.throws(() => rankHolders(null), /unavailable/)
})

test('counts top-level contract calls and sender activity across unique sampled blocks', () => {
  const block = { index: 12, transactions: [
    { from: 'alice', to: 'token', method: 'transfer' },
    { from: 'alice', to: 'token', method: 'transfer' },
    { from: 'bob', to: 'token', method: 'balanceOf' },
    { from: 'bob', to: 'factory', method: 'deploy' },
    { from: 'carol', to: 'deployment-code' }
  ] }
  const result = rankActivity([{ index: 10, transactions: [] }, block, block])
  assert.equal(result.blocks, 2)
  assert.equal(result.start, 10)
  assert.equal(result.end, 12)
  assert.deepEqual(result.contracts, [
    { address: 'token', count: 3, callers: 2 },
    { address: 'factory', count: 1, callers: 1 }
  ])
  assert.deepEqual(result.addresses, [
    { address: 'alice', count: 2 }, { address: 'bob', count: 2 }, { address: 'carol', count: 1 }
  ])
  assert.equal(rankActivity([block], 1).contracts.length, 1)
})

test('empty activity is explicitly empty and malformed block samples are rejected', () => {
  assert.deepEqual(rankActivity([]), { blocks: 0, start: null, end: null, contracts: [], addresses: [] })
  assert.throws(() => rankActivity([{ index: 1 }]), /Invalid ranking block transactions/)
  assert.throws(() => rankActivity([{ index: NaN, transactions: [] }]), /Invalid ranking block index/)
})

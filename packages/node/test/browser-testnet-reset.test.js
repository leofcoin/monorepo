import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BROWSER_TESTNET_RESET_KEY,
  completePendingBrowserTestnetReset,
  getBrowserTestnetResetFailure,
  scheduleBrowserTestnetReset
} from '../src/controllers/browser-testnet-reset.js'

const sessionStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values
  }
}

test('schedules a Peach reset by reloading and refuses other networks', () => {
  const storage = sessionStorage()
  let reloads = 0
  scheduleBrowserTestnetReset({
    network: { key: 'peach' },
    storage,
    location: { reload: () => { reloads++ } }
  })
  assert.equal(storage.getItem(BROWSER_TESTNET_RESET_KEY), 'peach')
  assert.equal(reloads, 1)
  assert.throws(() => scheduleBrowserTestnetReset({
    network: { key: 'mainnet' }, storage, location: { reload() {} }
  }), /Only the local Peach testnet/)
})

test('reset runs only after reload, clears scoped ledger stores, and preserves wallet data', async () => {
  const storage = sessionStorage({ [BROWSER_TESTNET_RESET_KEY]: 'peach' })
  const cleared = []
  const deleted = []
  class FakeStorage {
    constructor(name) {
      this.name = name
      this.records = new Map(name === 'wallet' ? [
        ['identity', new Uint8Array([1, 2])],
        ['custom', new Uint8Array([3])],
        ['beacon/private/old', new Uint8Array([4])],
        ['beacon/public/old', new Uint8Array([5])]
      ] : [['old', new Uint8Array([6])]])
    }
    async init() {}
    async clear() { cleared.push(this.name); this.records.clear() }
    async keys() { return [...this.records.keys()] }
    async entries() { return [...this.records].map(([key, value]) => [key, Uint8Array.from(value)]) }
    async delete(key) { deleted.push(key); this.records.delete(key) }
  }

  assert.equal(await completePendingBrowserTestnetReset({ storage, StorageClass: FakeStorage }), true)
  assert.deepEqual(cleared.sort(), [
    'accounts-peach', 'block-peach', 'chain-peach', 'contract-peach',
    'state-peach', 'transaction-peach', 'transactionPool-peach'
  ])
  assert.deepEqual(deleted.sort(), ['beacon/private/old', 'beacon/public/old'])
  assert.equal(storage.getItem(BROWSER_TESTNET_RESET_KEY), null)
  assert.equal(getBrowserTestnetResetFailure(), '')
})

test('a failed reset keeps its retry marker and blocks node startup', async () => {
  const storage = sessionStorage({ [BROWSER_TESTNET_RESET_KEY]: 'peach' })
  class FailingStorage {
    constructor(name) { this.name = name }
    async init() {}
    async clear() { throw new Error('storage unavailable') }
    async keys() { return [] }
    async entries() { return [] }
    async delete() {}
  }

  await assert.rejects(completePendingBrowserTestnetReset({ storage, StorageClass: FailingStorage }), /reset incomplete/)
  assert.equal(storage.getItem(BROWSER_TESTNET_RESET_KEY), 'peach')
  assert.match(getBrowserTestnetResetFailure(), /Keep the wallet locked and reload to retry/)
})

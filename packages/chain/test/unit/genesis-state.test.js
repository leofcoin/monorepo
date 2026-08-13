import assert from 'node:assert/strict'
import test from 'node:test'

import { clearGenesisState, genesisStateStores } from '../../../../scripts/genesis-state.js'

test('genesis reset clears every persisted chain-state store', async () => {
  const cleared = []
  const stores = Object.fromEntries(genesisStateStores.map((name) => [name, { clear: async () => cleared.push(name) }]))
  const deleted = []
  stores.walletStore = {
    keys: async () => ['identity', 'beacon/private/leofcoin/1'],
    delete: async (key) => deleted.push(key)
  }

  await clearGenesisState(stores)

  assert.deepEqual(cleared.sort(), [...genesisStateStores].sort())
  assert.ok(cleared.includes('chainStore'))
  assert.ok(cleared.includes('stateStore'))
  assert.deepEqual(deleted, ['beacon/private/leofcoin/1'])
})

test('genesis reset fails closed when a required chain store is unavailable', async () => {
  await assert.rejects(clearGenesisState({}), /genesis state store is unavailable: blockStore/)
})

test('genesis reset fails closed when private beacon cleanup is unavailable', async () => {
  const stores = Object.fromEntries(genesisStateStores.map((name) => [name, { clear: async () => {} }]))
  await assert.rejects(clearGenesisState(stores), /genesis state store is unavailable: walletStore/)
})

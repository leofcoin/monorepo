import assert from 'node:assert/strict'
import test from 'node:test'

import { clearGenesisState, genesisStateStores } from '../../../../scripts/genesis-state.js'

test('genesis reset clears every persisted chain-state store', async () => {
  const cleared = []
  const stores = Object.fromEntries(
    genesisStateStores.map((name) => [name, { clear: async () => cleared.push(name) }])
  )

  await clearGenesisState(stores)

  assert.deepEqual(cleared.sort(), [...genesisStateStores].sort())
  assert.ok(cleared.includes('chainStore'))
  assert.ok(cleared.includes('stateStore'))
})

test('genesis reset fails closed when a required store is unavailable', async () => {
  await assert.rejects(clearGenesisState({}), /genesis state store is unavailable: blockStore/)
})

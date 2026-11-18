import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { dexFactorySource } from '../exports/genesis-plan.js'
import { prepareGenesisContractSource } from '../../../scripts/genesis-contract-source.js'

test('reviewed DEX genesis source matches the built pool factory contract', async () => {
  const bundle = await readFile(new URL('../../contracts/exports/liquidity-pool-factory.js', import.meta.url), 'utf8')
  assert.equal(new TextDecoder().decode(dexFactorySource), prepareGenesisContractSource(bundle))
})

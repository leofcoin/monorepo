import assert from 'node:assert/strict'
import test from 'node:test'

import { parseGenesisAllocations, validateGenesisSupply } from '../../../../scripts/genesis-allocations.js'

const parseUnits = (value) => BigInt(value) * 1_000_000n

test('canonicalizes allocations and verifies their exact initial supply', () => {
  const allocations = parseGenesisAllocations(
    JSON.stringify([
      { address: 'treasury', amount: '6' },
      { address: 'alice', amount: '4' }
    ]),
    parseUnits
  )
  assert.deepEqual(allocations, [
    { address: 'alice', amount: '4000000' },
    { address: 'treasury', amount: '6000000' }
  ])
  assert.deepEqual(validateGenesisSupply('100', '10', allocations, parseUnits), {
    target: '100000000',
    initial: '10000000'
  })
})

test('supports assigning the complete initial supply to the generated genesis account', () => {
  const account = 'generated-genesis-account'
  const initialSupply = '10'
  const allocations = parseGenesisAllocations(JSON.stringify([{ address: account, amount: initialSupply }]), parseUnits)
  const supply = validateGenesisSupply('100', initialSupply, allocations, parseUnits)
  assert.deepEqual(allocations, [{ address: account, amount: '10000000' }])
  assert.deepEqual(supply, { target: '100000000', initial: '10000000' })
})

test('rejects duplicate allocations, mismatched totals and initial supply above target', () => {
  assert.throws(
    () =>
      parseGenesisAllocations(
        JSON.stringify([
          { address: 'alice', amount: 1 },
          { address: 'alice', amount: 2 }
        ]),
        parseUnits
      ),
    /duplicate/
  )
  const allocations = [{ address: 'alice', amount: '9000000' }]
  assert.throws(() => validateGenesisSupply('100', '10', allocations, parseUnits), /must equal/)
  assert.throws(() => validateGenesisSupply('5', '10', allocations, parseUnits), /positive and not exceed target/)
})

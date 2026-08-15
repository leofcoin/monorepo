import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareGenesisContractSource } from '../../../../scripts/genesis-contract-source.js'

test('turns a mixed named/default Rollup export into executable contract source', () => {
  const source = 'const POLICY = "v1"; class Token {} export { POLICY, Token as default };'
  const executable = prepareGenesisContractSource(source)
  const Contract = new Function(executable)()

  assert.equal(Contract.name, 'Token')
  assert.doesNotMatch(executable, /\bexport\b/)
})

test('rejects bundles without a default contract export', () => {
  assert.throws(
    () => prepareGenesisContractSource('class Token {} export { Token };'),
    /no default export/
  )
})

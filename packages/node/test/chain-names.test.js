import assert from 'node:assert/strict'
import test from 'node:test'
import { chainNameForId, shortChainId } from '../src/chain-names.js'

const peachId = 'lfc:8a6f0e72d3366bbf579e91dc7bcd716f02763511cee2f05a3b65429a6b400f18'

test('published chain names only resolve exact known chain IDs', () => {
  assert.equal(chainNameForId(peachId), 'Peach testnet')
  assert.equal(chainNameForId('lfc:' + '0'.repeat(64)), undefined)
  assert.equal(chainNameForId(peachId.toUpperCase()), undefined)
})

test('chain ID display is short but retains a recognizable prefix and suffix', () => {
  assert.equal(shortChainId(peachId), 'lfc:8a6f0e72d3…6b400f18')
  assert.equal(shortChainId(''), '')
})

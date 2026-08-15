import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const consensusContracts = [
  'exports/private-voting.js',
  'exports/public-voting.js',
  'exports/token-receiver.js'
]

test('consensus contract bundles use the deterministic Date.now API', async () => {
  for (const path of consensusContracts) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /new\s+Date\b/, `${path} contains a non-deterministic Date constructor`)
  }
})

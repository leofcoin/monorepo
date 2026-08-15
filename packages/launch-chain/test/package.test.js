import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('exports the built launch function', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )

  assert.equal(manifest.exports['.'].import, './exports/index.js')
  await readFile(new URL(`../${manifest.exports['.'].types}`, import.meta.url), 'utf8')
  assert.equal(typeof (await import('../exports/index.js')).default, 'function')
})

test('uses the workspace chain runtime', async () => {
  await import('@leofcoin/chain/chain')
  await import('@leofcoin/chain/node')
})

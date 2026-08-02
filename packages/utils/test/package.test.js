import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('declares ethers as a runtime dependency', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )

  assert.equal(manifest.dependencies.ethers, '^6.17.0')
  assert.equal(manifest.devDependencies.ethers, undefined)
})

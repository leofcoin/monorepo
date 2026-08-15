import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('exports importable HTTP and WebSocket servers with declarations', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )

  for (const name of ['http', 'ws']) {
    const entry = manifest.exports[`./${name}`]
    await readFile(new URL(`../${entry.types}`, import.meta.url), 'utf8')
    assert.equal(typeof (await import(`../exports/${name}.js`)).default, 'function')
  }
})

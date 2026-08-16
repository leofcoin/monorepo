import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'

const run = promisify(execFile)

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

test('exports a standalone validator runtime and CLI', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./validator'].import, './exports/validator.js')
  assert.equal(manifest.bin['leofcoin-validator'], './exports/validator-cli.js')
  const runtime = await import('../exports/validator.js')
  assert.equal(typeof runtime.startValidator, 'function')
  assert.throws(() => runtime.validateIntervalMinutes(0), /at least one minute/)
  assert.equal(runtime.validateIntervalMinutes(1), 1)

  const { stdout } = await run(process.execPath, [new URL('../exports/validator-cli.js', import.meta.url).pathname, '--help'])
  assert.match(stdout, /Usage: leofcoin-validator/)
  assert.match(stdout, /--password-file/)
})

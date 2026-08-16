import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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
  assert.equal(manifest.bin.leofcoin, './exports/validator-cli.js')
  const runtime = await import('../exports/validator.js')
  assert.equal(typeof runtime.startValidator, 'function')
  assert.throws(() => runtime.validateIntervalMinutes(0), /at least one minute/)
  assert.equal(runtime.validateIntervalMinutes(1), 1)

  const cli = fileURLToPath(new URL('../exports/validator-cli.js', import.meta.url))
  const { stdout } = await run(process.execPath, [cli, '--help'])
  assert.match(stdout, /leofcoin-validator \[options\]/)
  assert.match(stdout, /--password-file/)
  assert.match(stdout, /leofcoin transfer/)
  await assert.rejects(run(process.execPath, [cli, '--password-file', '--interval', '5']), /requires a value/)
})

test('does not block validator startup on heartbeat finalization', async () => {
  const source = await readFile(new URL('../src/validator.ts', import.meta.url), 'utf8')
  assert.match(source, /void heartbeat\(\)/)
  assert.doesNotMatch(source, /await heartbeat\(\)/)
})

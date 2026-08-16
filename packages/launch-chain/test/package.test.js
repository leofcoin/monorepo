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
  assert.equal(manifest.exports['./node'].import, './exports/node.js')
  assert.equal(manifest.bin['leofcoin-validator'], './exports/validator-cli.js')
  assert.equal(manifest.bin.leofcoin, './exports/cli.js')
  const runtime = await import('../exports/validator.js')
  const nodeRuntime = await import('../exports/node.js')
  assert.equal(typeof runtime.startValidator, 'function')
  assert.equal(typeof nodeRuntime.startNode, 'function')
  assert.throws(() => runtime.validateIntervalMinutes(0), /at least one minute/)
  assert.equal(runtime.validateIntervalMinutes(1), 1)

  const cli = fileURLToPath(new URL('../exports/cli.js', import.meta.url))
  const { stdout } = await run(process.execPath, [cli, '--help'])
  assert.match(stdout, /leofcoin node \[options\]/)
  assert.match(stdout, /leofcoin validator \[options\]/)
  assert.match(stdout, /leofcoin status \[options\]/)
  assert.match(stdout, /--password-file/)
  assert.match(stdout, /leofcoin transfer/)
  await assert.rejects(run(process.execPath, [cli, '--password-file', '--interval', '5']), /requires a value/)
})

test('parses commands and common node options in any order', async () => {
  const { parseCliOptions } = await import('../exports/cli-options.js')
  assert.deepEqual(parseCliOptions(['--root', '/data', 'node', '--no-endpoints']), {
    command: 'node',
    positionals: [],
    root: '/data',
    httpPort: false,
    wsPort: false,
    shell: true
  })
  assert.deepEqual(parseCliOptions(['transfer', 'YTq-recipient', '12.5', '--star', 'wss://one', '--star', 'wss://two']), {
    command: 'transfer',
    positionals: ['YTq-recipient', '12.5'],
    stars: ['wss://one', 'wss://two'],
    httpPort: 8080,
    wsPort: 4040,
    shell: true
  })
  assert.throws(() => parseCliOptions(['node', '--http-port', '70000']), /valid port/)
  assert.throws(() => parseCliOptions(['wat']), /unknown command/)
})

test('one-shot wallet commands use a normal node rather than validator participation', async () => {
  const source = await readFile(new URL('../src/cli.ts', import.meta.url), 'utf8')
  assert.match(source, /options\.command === 'validator'/)
  assert.match(source, /: await startNode\(common\)/)
})

test('normalizes absolute CLI data roots for home-relative storage', async () => {
  const source = await readFile(new URL('../src/cli.ts', import.meta.url), 'utf8')
  assert.match(source, /isAbsolute\(root\) \? relative\(homedir\(\), root\) : root/)
  assert.match(source, /root: dataRootFor/)
})

test('does not block validator startup on heartbeat finalization', async () => {
  const source = await readFile(new URL('../src/validator.ts', import.meta.url), 'utf8')
  assert.match(source, /void heartbeat\(\)/)
  assert.doesNotMatch(source, /await heartbeat\(\)/)
})

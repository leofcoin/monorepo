import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  assert.match(stdout, /type batch/)
  assert.match(stdout, /leofcoin batch/)
  await assert.rejects(run(process.execPath, [cli, 'batch']), /requires a terminal/)
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

  test('CLI startup failures exit even when partially started runtimes leave open handles', async () => {
    const nodeUrl = new URL('../exports/node.js', import.meta.url).href
    const validatorUrl = new URL('../exports/validator.js', import.meta.url).href
    const hook = `import { registerHooks } from 'node:module';
      registerHooks({ load(url, context, next) {
        if (url === ${JSON.stringify(nodeUrl)} || url === ${JSON.stringify(validatorUrl)})
          return { format: 'module', shortCircuit: true,
            source: 'export async function startNode() { setInterval(() => {}, 1000); throw new Error("fixture startup rejected") }; export const startValidator = startNode;' };
        return next(url, context);
      } });`
    for (const entry of ['cli.js', 'validator-cli.js']) {
      await assert.rejects(run(process.execPath, [
        '--import', `data:text/javascript,${encodeURIComponent(hook)}`,
        fileURLToPath(new URL(`../exports/${entry}`, import.meta.url)), 'validator'
      ], { timeout: 5000 }), error => {
        assert.equal(error.killed, false, `${entry} must exit without the test killing it`)
        assert.equal(error.code, 1)
        assert.match(error.stderr, /fixture startup rejected/)
        return true
      })
    }
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
  assert.equal(parseCliOptions(['batch', '--root', '/existing']).command, 'batch')
})

test('CLI executes through a symlink, including npm bin entry points', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'leofcoin-cli-link-'))
  try {
    const link = join(temporary, 'leofcoin')
    await symlink(fileURLToPath(new URL('../exports/cli.js', import.meta.url)), link)
    const { stdout } = await run(process.execPath, [link, '--help'])
    assert.match(stdout, /leofcoin node \[options\]/)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('CLI can be imported by an embedding process with a non-file argv', async () => {
  const url = new URL('../exports/cli.js', import.meta.url).href
  const { stdout } = await run(process.execPath, [
    '--input-type=module', '-e',
    `const { runCli } = await import(${JSON.stringify(url)}); console.log(typeof runCli)`,
    'not-a-cli-file'
  ])
  assert.equal(stdout.trim(), 'function')
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

test('interactive shell exposes batch and validator pauses heartbeats while the wallet is reserved', async () => {
  const [cli, validator, node] = await Promise.all(['cli', 'validator', 'node'].map(name =>
    readFile(new URL(`../src/${name}.ts`, import.meta.url), 'utf8')))
  assert.match(cli, /command === 'batch'/)
  assert.match(cli, /await handle\.batch/)
  assert.match(validator, /sending \|\| node\.walletBusy/)
  assert.match(validator, /batch: node\.batch/)
  assert.match(node, /if \(activeTransfers\) throw/)
  assert.match(node, /finally \{ batchActive = false \}/)
  assert.match(cli, /Batch requires an existing local wallet/)
})

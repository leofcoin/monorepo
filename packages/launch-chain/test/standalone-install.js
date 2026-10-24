// Reuse built artifacts, but resolve every external dependency from npm, without
// workspace links. The three unpublished packages travel together as tarballs.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packages = fileURLToPath(new URL('../..', import.meta.url))
const temporary = mkdtempSync(join(tmpdir(), 'leofcoin-launch-package-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (command, args, cwd, timeout = 180_000) => execFileSync(command, args, {
  cwd, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
})

try {
  const dependencies = {}
  const artifacts = new Set()
  for (const name of ['lib', 'chain', 'launch-chain']) {
    const directory = join(packages, name)
    assert.ok(existsSync(join(directory, 'exports')), `build ${name} before test:package`)
    const [packed] = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', temporary], directory))
    assert.ok(packed.files.some(file => file.path.startsWith('exports/')))
    assert.ok(packed.files.every(file => !file.path.startsWith('node_modules/')))
    dependencies[packed.name] = `file:${join(temporary, packed.filename)}`
    artifacts.add(`node_modules/${packed.name}`)
  }
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }))
  // No hooks are necessary for an offline normal node. HTTP/3 native loading is
  // covered by swarm's relay tests; do not run arbitrary installation hooks here.
  run(npm, ['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], temporary)
  const lock = JSON.parse(readFileSync(join(temporary, 'package-lock.json'), 'utf8'))
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (artifacts.has(path)) continue
    assert.ok(!entry.link, `unexpected workspace link: ${path}`)
    assert.ok(!/^(git\+|git:|github:|file:)/.test(entry.resolved ?? ''), `not from registry: ${path}`)
    if (path.endsWith('/@leofcoin/peernet')) assert.equal(entry.version, '3.0.0')
    if (path.endsWith('/@netpeer/swarm')) assert.equal(entry.version, '0.10.0')
  }
  assert.equal(lock.packages['node_modules/@leofcoin/peernet'].version, '3.0.0')
  assert.equal(lock.packages['node_modules/@netpeer/swarm'].version, '0.10.0')
  const cli = join(temporary, 'node_modules/@leofcoin/launch-chain/exports/cli.js')
  assert.match(run(process.execPath, [cli, '--help'], temporary), /leofcoin node/)
  const smoke = readFileSync(new URL('./installed-smoke.mjs', import.meta.url), 'utf8')
  // Workers inherit execArgv: --input-type=module would break their file entry.
  const smokePath = join(temporary, 'smoke.mjs')
  writeFileSync(smokePath, smoke)
  const output = run(process.execPath, [smokePath], temporary, 30_000)
  assert.match(output, /STANDALONE_LAUNCH_READY/)
  console.log(output.trim())
  console.log('PASS: packed launcher starts a real-genesis offline node with registry peernet 3 / swarm 0.10')
} catch (error) {
  // Preserve useful subprocess diagnostics without ever inspecting real stores.
  if (error.stdout) process.stderr.write(error.stdout)
  if (error.stderr) process.stderr.write(error.stderr)
  throw error
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

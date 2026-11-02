// Install a reviewed, locked npm baseline, never into the workspace dependency tree.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const cache = resolve(root, 'node_modules/.cache')
const target = resolve(process.argv[2] || join(cache, 'chain-baseline-1.10.22'))
const inside = relative(cache, target)
assert(inside && !inside.startsWith('..') && !isAbsolute(inside), 'Baseline must be a private subdirectory of node_modules/.cache')
await mkdir(target, { recursive: true })
for (const name of ['package.json', 'package-lock.json']) {
  const expected = await readFile(join(root, 'test/bench/baseline', name), 'utf8')
  const actual = await readFile(join(target, name), 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error })
  if (actual !== undefined) assert.equal(actual.trim(), expected.trim(), `Refusing to overwrite a different baseline ${name}`)
  else await writeFile(join(target, name), expected, { flag: 'wx' })
}
const ready = join(target, '.installed-lock')
const lock = await readFile(join(target, 'package-lock.json'), 'utf8')
if (await readFile(ready, 'utf8').catch(() => '') !== lock) {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['ci', '--ignore-scripts', '--include=optional', '--no-audit', '--no-fund'], { cwd: target, stdio: 'inherit' })
  await writeFile(ready, lock)
}
console.log(`Baseline ready: ${target}`)
console.log(`npm run benchmark:chain -- --baseline '${target}'`)

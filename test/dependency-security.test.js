import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { assertPatchedMonacoModules, patchedMonacoSanitizer } from '../packages/node/scripts/monaco-sanitizer.js'

const root = new URL('../', import.meta.url)
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const manifest = read('package.json')
const packages = read('package-lock.json').packages
const version = value => {
  assert.match(value, /^\d+\.\d+\.\d+$/, 'Review prerelease dependency versions explicitly')
  return value.split('.').map(Number)
}
const atLeast = (actual, minimum) => {
  const a = version(actual), b = version(minimum)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}
const locked = name => Object.entries(packages).filter(([path]) => path.endsWith(`node_modules/${name}`))

// Reviewed floors, not a replacement for Dependabot or an online npm audit.
for (const [name, minimum] of [['dompurify', '3.4.17'], ['serialize-javascript', '7.1.4'], ['@rollup/plugin-terser', '1.0.2']]) {
  test(`${name} is locked above its reviewed security floor`, () => {
    const entries = locked(name)
    assert.ok(entries.length, `Missing ${name} in the workspace lockfile`)
    for (const [path, dependency] of entries)
      assert.ok(atLeast(dependency.version, minimum), `${path}@${dependency.version} must be >= ${minimum}`)
  })
}

test('every locked Rollup branch includes the path-traversal fix', () => {
  const entries = locked('rollup')
  assert.ok(entries.length)
  for (const [path, dependency] of entries) {
    const [major] = version(dependency.version)
    const minimum = { 2: '2.80.0', 3: '3.30.0', 4: '4.59.0' }[major]
    assert.ok(major > 4 || minimum && atLeast(dependency.version, minimum), `${path}@${dependency.version} is below its patched branch`)
  }
})

test('Monaco sanitizer override remains patched without requiring an editor upgrade', () => {
  assert.ok(atLeast(manifest.overrides['monaco-editor'].dompurify, '3.4.17'))
})

test('Monaco replaces only its vendored sanitizer and rejects unsafe generated module graphs', () => {
  const plugin = patchedMonacoSanitizer()
  const importer = '/repo/node_modules/monaco-editor/esm/vs/base/browser/domSanitize.js'
  const vendored = '/repo/node_modules/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js'
  const patched = plugin.resolveId('./dompurify/dompurify.js', importer)
  assert.ok(patched.replaceAll('\\', '/').endsWith('/dompurify/dist/purify.es.mjs'))
  assert.equal(plugin.resolveId('./dompurify/dompurify.js', '/repo/unrelated.js'), null)
  assert.equal(plugin.resolveId('./other.js', importer), null)
  assert.doesNotThrow(() => assertPatchedMonacoModules([patched, importer], patched))
  assert.throws(() => assertPatchedMonacoModules([vendored, importer], patched), /patched npm DOMPurify/)
  assert.throws(() => assertPatchedMonacoModules([patched, vendored], patched), /obsolete vendored/)
  assert.doesNotThrow(() => assertPatchedMonacoModules([patched.replaceAll('/', '\\')], patched))
})

test('contracts uses the root workspace lock instead of its obsolete standalone lock', () => {
  assert.equal(existsSync(new URL('packages/contracts/package-lock.json', root)), false)
  assert.equal(packages['node_modules/@leofcoin/contracts'].resolved, 'packages/contracts')
})

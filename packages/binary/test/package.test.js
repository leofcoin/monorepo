import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

test('npm tarball includes built entry points and works outside the workspace', () => {
  const directory = mkdtempSync(join(tmpdir(), 'leofcoin-binary-pack-'))
  try {
    const workspace = fileURLToPath(new URL('..', import.meta.url))
    const [packed] = JSON.parse(execFileSync('npm', [
      'pack', '--json', '--workspaces=false', '--pack-destination', directory
    ], { cwd: workspace, encoding: 'utf8' }))
    const files = new Set(packed.files.map(({ path }) => path))
    for (const entry of ['exports/index.js', 'exports/index.d.ts', 'package.json'])
      assert.ok(files.has(entry), `Published tarball is missing ${entry}`)

    execFileSync('tar', ['-xzf', join(directory, packed.filename), '-C', directory])
    const manifest = JSON.parse(readFileSync(join(directory, 'package/package.json'), 'utf8'))
    assert.deepEqual(manifest.dependencies ?? {}, {})
    const entry = pathToFileURL(join(directory, 'package', manifest.exports['.'].import)).href
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict'
      import { BinaryReader, BinaryWriter, encodeFrames, decodeFrames } from ${JSON.stringify(entry)}
      const value = 10n ** 30n
      assert.equal(new BinaryReader(new BinaryWriter().writeVarBigInt(value).finish()).readVarBigInt(), value)
      const fields = [new Uint8Array([1, 2, 3]), new Uint8Array()]
      assert.deepEqual(decodeFrames(encodeFrames(fields)), fields)
    `], { cwd: directory, stdio: 'pipe' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

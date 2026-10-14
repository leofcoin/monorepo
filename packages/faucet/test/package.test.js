import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, access } from 'node:fs/promises'

test('faucet is public and ships its standalone CLI and deployment templates', async () => {
  const root = new URL('../', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
  assert.notEqual(manifest.private, true)
  assert.equal(manifest.publishConfig.access, 'public')
  assert.equal(manifest.bin['leofcoin-faucet'], './src/cli.js')
  assert.deepEqual(manifest.files, ['src/cli.js', 'src/server.js', 'src/service.js', 'deploy', 'README.md'])
  for (const path of manifest.files) await access(new URL(path, root))
  const cli = await readFile(new URL(manifest.bin['leofcoin-faucet'], root), 'utf8')
  assert.ok(cli.startsWith('#!/usr/bin/env node\n'))
})

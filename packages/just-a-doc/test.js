import parse from './src/index.ts'
import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('generates documentation into an isolated output directory', async () => {
  const output = await mkdtemp(join(tmpdir(), 'doc-it-'))
  try {
    await parse({
      input: ['./testClass.js'],
      output,
      readme: './README.md'
    })
    await assert.doesNotReject(access(join(output, 'index.html')))
    await assert.doesNotReject(access(join(output, 'testClass.js')))
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  generateGenesisPassword,
  prepareGenesisCredentials,
  writeGenesisIdentityBackup
} from '../../../../scripts/genesis-credentials.js'

test('generates a high-entropy URL-safe genesis password', () => {
  const first = generateGenesisPassword()
  const second = generateGenesisPassword()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
})

test('writes a private and non-overwritable recovery bundle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lfc-genesis-credentials-'))
  const credentials = await prepareGenesisCredentials({ directory })
  await writeGenesisIdentityBackup({
    identity: 'encrypted-identity',
    account: 'genesis-account',
    paths: credentials.paths
  })

  assert.equal((await readFile(credentials.paths.password, 'utf8')).trim(), credentials.password)
  assert.equal((await readFile(credentials.paths.identity, 'utf8')).trim(), 'encrypted-identity')
  assert.match(await readFile(credentials.paths.readme, 'utf8'), /Genesis account: genesis-account/)
  assert.equal((await stat(credentials.paths.password)).mode & 0o777, 0o600)
  assert.equal((await stat(credentials.paths.identity)).mode & 0o777, 0o600)
  await assert.rejects(() => prepareGenesisCredentials({ directory }), { code: 'EEXIST' })
})

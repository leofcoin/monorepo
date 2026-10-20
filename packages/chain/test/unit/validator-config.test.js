import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import { validatorPasswordFile } from '../../../../scripts/validator-config.js'

const execute = promisify(execFile)

test('repository validator defaults to the generated Peach password file independently of cwd', () => {
  const expected = new URL('../../../../genesis-credentials/leofcoin-peach/genesis-password.txt', import.meta.url)
  assert.equal(validatorPasswordFile([], {}), decodeURIComponent(expected.pathname))
  assert.equal(validatorPasswordFile(['--root', '/custom/data'], {}), decodeURIComponent(expected.pathname))
})

test('explicit password sources and informational commands bypass automatic credentials', () => {
  for (const flag of ['--help', '-h', '--version', '-v', '--password-file']) {
    assert.equal(validatorPasswordFile([flag], {}), undefined)
  }
  assert.equal(validatorPasswordFile([], { LEOFCOIN_PASSWORD_FILE: '/explicit/file' }), undefined)
  assert.equal(validatorPasswordFile([], { LEOFCOIN_PASSWORD: 'test-only-placeholder' }), undefined)
  assert.equal(validatorPasswordFile([], { GENESIS_PASSWORD_FILE: '/genesis/password.txt' }), '/genesis/password.txt')
  assert.equal(validatorPasswordFile([], { GENESIS_PASSWORD_FILE: 'custom/password.txt' }, '/repo'), '/repo/custom/password.txt')
})

test('custom genesis credentials resolve from the repository without borrowing another network identity', () => {
  assert.equal(validatorPasswordFile([], { LFC_GENESIS_CREDENTIALS_DIR: '/private/custom' }), '/private/custom/genesis-password.txt')
  assert.equal(validatorPasswordFile([], { LFC_GENESIS_CREDENTIALS_DIR: 'custom' }, '/repo'), '/repo/custom/genesis-password.txt')
  assert.throws(() => validatorPasswordFile(['--network', 'leofcoin:mainnet'], {}), /non-Peach/)
  assert.throws(() => validatorPasswordFile([], { LEOFCOIN_NETWORK: 'leofcoin:mainnet' }), /non-Peach/)
  assert.equal(validatorPasswordFile(['--network', 'leofcoin:peach'], { LEOFCOIN_NETWORK: 'leofcoin:mainnet' }), validatorPasswordFile([], {}))
})

test('missing automatic password file fails before opening an identity or prompting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'leofcoin-validator-credentials-'))
  try {
    const env = { ...process.env, LFC_GENESIS_CREDENTIALS_DIR: directory, LEOFCOIN_NETWORK: 'leofcoin:peach' }
    delete env.LEOFCOIN_PASSWORD
    delete env.LEOFCOIN_PASSWORD_FILE
    delete env.GENESIS_PASSWORD_FILE
    for (const [script, cwd] of [
      ['scripts/run-validator.js', new URL('../../../../', import.meta.url)],
      ['../../scripts/run-validator.js', new URL('../../', import.meta.url)]
    ]) {
      await assert.rejects(execute(process.execPath, [script], { cwd, env, timeout: 5000 }), (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stderr, /ENOENT/)
        assert.match(error.stderr, /genesis-password\.txt/)
        assert.doesNotMatch(`${error.stdout}${error.stderr}`, /Enter password|Chain created|validator account:/)
        return true
      })
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

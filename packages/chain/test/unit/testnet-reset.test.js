import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import Store from '@leofcoin/storage/store'
import { parseResetOptions, resetPlan, resetTestnetData } from '../../../../scripts/reset-testnet-data.js'

const execute = promisify(execFile)
const script = new URL('../../../../scripts/reset-testnet-data.js', import.meta.url)
const bytes = value => new TextEncoder().encode(value)
async function open(root, name) {
  const store = new Store()
  await store.init(name, root, '1', false, false)
  await store.db.open()
  return store.db
}
async function entries(root, name) {
  const db = await open(root, name)
  try { return await db.iterator().all() } finally { await db.close() }
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'leofcoin-testnet-reset-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'peach')
  await mkdir(source)
  const data = {
    account: { public: JSON.stringify({ walletId: 'test-wallet' }) },
    wallet: { identity: JSON.stringify({ walletId: 'test-wallet', multiWIF: 'test-only-encrypted-value' }),
      accounts: JSON.stringify([['main', 'test-account', 'test-internal']]), 'selected-account': 'test-account',
      version: '1', 'beacon/private/old': 'old-share', 'beacon/public/old': 'old-round', 'custom-label': 'keep-me' },
    chain: { version: '0.4.0', lastBlock: 'legacy-block-hash' },
    block: { 'legacy-block-hash': 'old-block-bytes' },
    transaction: { old: 'old-transaction-bytes' },
    transactionPool: { pending: 'old-signed-transaction' },
    accounts: { 'test-account': '1478' },
    state: { lastBlock: 'old-tip', 'checkpoint:0': 'old-checkpoint' },
    contract: { old: 'old-contract-code' },
    data: { file: 'unrelated-user-data' },
    message: { chat: 'unrelated-message' },
    share: { file: 'unrelated-share' }
  }
  for (const [name, values] of Object.entries(data)) {
    const db = await open(source, name)
    try { await db.batch(Object.entries(values).map(([key, value]) => ({ type: 'put', key, value: bytes(value) }))) }
    finally { await db.close() }
  }
  await writeFile(join(source, 'operator-note.txt'), 'keep this too')
  return { directory, source, data }
}

test('reset preview does not open databases or delete anything', async t => {
  const { source } = await fixture(t)
  const before = await readdir(join(source, 'chain'))
  const result = await resetTestnetData({ root: source })
  assert.equal(result.mode, 'preview')
  assert.equal(result.backup, false)
  assert.deepEqual(await readdir(join(source, 'chain')), before)
  assert.deepEqual(result.clear.sort(), ['accounts', 'block', 'chain', 'contract', 'state', 'transaction', 'transactionPool'])
})

test('reset deletes only ledger/beacon data, retaining wallet bytes, account, root and unrelated files', async t => {
  const { source, directory, data } = await fixture(t)
  const original = Object.fromEntries(await Promise.all(Object.keys(data).map(async name => [name, await entries(source, name)])))
  const result = await resetTestnetData({ root: source, confirm: true })
  assert.equal(result.mode, 'completed')
  assert.equal(result.selectedAccount, 'test-account')
  assert.equal(result.backup, false)
  assert.deepEqual(await readdir(directory), ['peach'], 'no backup or replacement root')
  for (const name of result.clear) assert.deepEqual(await entries(source, name), [], `${name} empty after reopen`)
  for (const name of ['account', 'data', 'message', 'share']) assert.deepEqual(await entries(source, name), original[name])
  assert.deepEqual(await entries(source, 'wallet'), original.wallet.filter(([key]) => !key.startsWith('beacon/')))
  assert.equal(await readFile(join(source, 'operator-note.txt'), 'utf8'), 'keep this too')
  assert.doesNotMatch(JSON.stringify(result), /test-only-encrypted-value|old-share/)
  assert.equal((await resetTestnetData({ root: source, confirm: true })).selectedAccount, 'test-account', 'repeat reset is safe')
})

test('a database held by another process prevents all deletion', async t => {
  const { source } = await fixture(t)
  const original = await entries(source, 'chain')
  const held = await open(source, 'wallet')
  try {
    await assert.rejects(execute(process.execPath, [script.pathname, '--root', source, '--confirm-testnet-reset'], {
      env: { ...process.env, LEOFCOIN_NETWORK: 'leofcoin:peach' }, timeout: 5000
    }), error => {
      assert.equal(error.code, 1)
      assert.match(error.stderr, /Cannot lock store wallet/)
      return true
    })
  } finally { await held.close() }
  assert.deepEqual(await entries(source, 'chain'), original)
  const db = await open(source, 'account')
  await db.close()
})

test('inconsistent identity is rejected before any data is cleared', async t => {
  const { source } = await fixture(t)
  const original = await entries(source, 'chain')
  const db = await open(source, 'account')
  await db.put('public', bytes(JSON.stringify({ walletId: 'different-wallet' }))); await db.close()
  await assert.rejects(resetTestnetData({ root: source, confirm: true }), /inconsistent existing identity/)
  assert.deepEqual(await entries(source, 'chain'), original)
})

test('broad roots, missing identities and symlink aliases fail closed', async t => {
  const { source, directory } = await fixture(t)
  await assert.rejects(resetPlan({ root: homedir() }), /broad filesystem root/)
  await assert.rejects(resetPlan({ root: '/' }), /broad filesystem root/)
  const empty = join(directory, 'empty')
  await mkdir(empty)
  await assert.rejects(resetPlan({ root: empty }), /Required existing identity store missing/)
  if (process.platform !== 'win32') {
    const alias = join(directory, 'alias')
    await symlink(source, alias)
    await assert.rejects(resetPlan({ root: alias }), /not a symlink/)
    await symlink(join(source, 'wallet'), join(source, 'linked-store'))
    await assert.rejects(resetPlan({ root: source }), /Symlinks/)
  }
})

test('malformed database directories are rejected rather than replaced', async t => {
  const { source } = await fixture(t)
  await rm(join(source, 'chain'), { recursive: true })
  await mkdir(join(source, 'chain'))
  await assert.rejects(resetPlan({ root: source }), /Invalid database: chain/)
})

test('CLI options require an explicit reset flag and never accept passwords or another network', () => {
  assert.deepEqual(parseResetOptions([], {}), { root: undefined, confirm: false })
  assert.equal(parseResetOptions([], { LEOFCOIN_DATA_ROOT: '/custom' }).root, '/custom')
  assert.throws(() => parseResetOptions(['--password', 'secret'], {}), /Unknown option/)
  assert.throws(() => parseResetOptions(['--root'], {}), /Missing value/)
  assert.throws(() => parseResetOptions([], { LEOFCOIN_NETWORK: 'leofcoin:mainnet' }), /only the Peach testnet/)
})

test('CLI preview/help never prompt or start a node; confirmed reset can be reopened', async t => {
  const { source } = await fixture(t)
  const env = { ...process.env, LEOFCOIN_NETWORK: 'leofcoin:peach' }
  const result = await execute(process.execPath, [script.pathname, '--root', source], { env, timeout: 5000 })
  assert.match(result.stdout, /"mode": "preview"/)
  assert.doesNotMatch(result.stdout + result.stderr, /Enter password|validator account:|chain.*init:/)
  const help = await execute(process.execPath, [script.pathname, '--help'], { env, timeout: 5000 })
  assert.match(help.stdout, /NO BACKUP/)
  const applied = await execute(process.execPath, [script.pathname, '--root', source, '--confirm-testnet-reset'], { env, timeout: 5000 })
  assert.match(applied.stdout, /"mode": "completed"/)
  assert.deepEqual(await entries(source, 'chain'), [])
  assert.equal((await entries(source, 'wallet')).some(([key]) => key === 'identity'), true)
})

import { ClassicLevel } from 'classic-level'
import { cp, chmod, lstat, mkdir, readdir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { TransactionMessage } from '@leofcoin/messages'
import { PROTOCOL_VERSION } from '../exports/hash-format-state.js'
import { readCheckpoint, recoveryHistory } from '../exports/state-checkpoint.js'

const ANCHOR_INDEX = 13
const ANCHOR_HASH = 'HNYQASBKOIRVRRHMLIPF6NTXDS2HAPVDFIPAKF2LYC67TPIUOP7SNJK62J'
const EXPECTED_BLOCK_TRANSACTION_COUNT = 256
const MIGRATION_KEY = 'migration:0.5.0-to-0.6.0'
const encode = value => new TextEncoder().encode(value)

const args = new Map()
for (const argument of process.argv.slice(2)) {
  if (argument === '--dry-run') {
    args.set('dry-run', '')
    continue
  }
  const match = /^--([^=]+)=(.*)$/.exec(argument)
  if (!match) throw new Error(`Invalid argument: ${argument}`)
  args.set(match[1], match[2])
}

const rootArgument = args.get('root')
const backupArgument = args.get('backup')
const confirmation = args.get('confirm-checkpoint')
const dryRun = args.has('dry-run')
if (args.size !== (dryRun ? 4 : 3) || !rootArgument || !backupArgument || confirmation !== ANCHOR_HASH)
  throw new Error(
    `Usage: node packages/chain/scripts/migrate-peach-0.5-to-0.6.js ` +
    `--root=<stopped Peach data root> --backup=<new private backup path> ` +
    `--confirm-checkpoint=${ANCHOR_HASH}${dryRun ? '' : ' [--dry-run]'}`
  )

const root = resolve(rootArgument.replace(/^~/, homedir()))
const backup = resolve(backupArgument.replace(/^~/, homedir()))
if (!isAbsolute(rootArgument.replace(/^~/, homedir())) || backup === root || backup.startsWith(`${root}${sep}`))
  throw new Error('Ledger root must be explicit and the backup must be outside it')
const rootReal = await realpath(root)
const backupParent = await realpath(dirname(backup))
const backupResolved = join(backupParent, basename(backup))
if (backupResolved === rootReal || relative(rootReal, backupResolved).split(sep)[0] !== '..')
  throw new Error('Backup path must be outside the ledger root')

const names = ['chain', 'state', 'block', 'transaction']
const stores = new Map()
const dbOptions = { valueEncoding: 'view', createIfMissing: false }
try {
  for (const name of names) {
    const db = new ClassicLevel(join(rootReal, name), dbOptions)
    await db.open()
    stores.set(name, db)
  }
  const chain = stores.get('chain')
  const state = stores.get('state')
  const blocks = stores.get('block')
  const transactions = stores.get('transaction')
  const chainId = (await createChainIdentity('leofcoin:peach', addresses)).chainId
  const requiredContracts = [
    addresses.contractFactory, addresses.nativeToken, addresses.nameService, addresses.validators
  ]
  const checkpoint = await readCheckpoint({
    keys: () => state.keys().all(),
    get: key => state.get(key)
  }, chainId, requiredContracts)
  if (!checkpoint) throw new Error('No verified checkpoint exists; refusing automatic migration')
  const anchor = checkpoint.snapshot.lastBlock
  if (Number(anchor.index) !== ANCHOR_INDEX || anchor.hash !== ANCHOR_HASH)
    throw new Error(`Checkpoint does not match the confirmed migration anchor ${ANCHOR_INDEX}:${ANCHOR_HASH}`)

  const version = new TextDecoder().decode(await chain.get('version'))
  if (version !== '0.5.0') throw new Error(`Expected stored protocol 0.5.0, found ${version}`)
  const lastBlock = new TextDecoder().decode(await chain.get('lastBlock'))
  if (lastBlock !== ANCHOR_HASH) throw new Error('Canonical chain marker does not match checkpoint 13')
  const anchorHistory = await recoveryHistory(ANCHOR_HASH, hash => blocks.get(hash))
  if (anchorHistory.length !== ANCHOR_INDEX + 1 ||
    Number(anchorHistory.at(-1).index) !== ANCHOR_INDEX ||
    anchorHistory.at(-1).transactions.length !== EXPECTED_BLOCK_TRANSACTION_COUNT)
    throw new Error('Stored block history does not verify the expected checkpoint-13 anchor')

  const targetBytes = await chain.get('recoveryTarget')
  const targetHash = new TextDecoder().decode(targetBytes)
  const suffix = await recoveryHistory(targetHash, hash => blocks.get(hash), {
    index: ANCHOR_INDEX, hash: ANCHOR_HASH
  })
  if (suffix.length !== 1 || Number(suffix[0].index) !== ANCHOR_INDEX + 1)
    throw new Error('Recovery target is not exactly one block after checkpoint 13')
  const rejectedBlock = suffix[0]
  if (rejectedBlock.transactions.length !== EXPECTED_BLOCK_TRANSACTION_COUNT)
    throw new Error(`Expected recovery block 14 to contain ${EXPECTED_BLOCK_TRANSACTION_COUNT} transactions`)

  const resolved = await Promise.all(rejectedBlock.transactions.map(async hash => {
    const data = await transactions.get(hash)
    const transaction = new TransactionMessage(data)
    if (await transaction.hash() !== hash) throw new Error(`Transaction hash mismatch: ${hash}`)
    return transaction
  }))
  const committedAccounts = checkpoint.snapshot.accounts
  let nonceRejection
  try {
    const committed = new Map()
    for (const transaction of resolved.sort((left, right) => {
      const a = BigInt(left.decoded.nonce)
      const b = BigInt(right.decoded.nonce)
      return a < b ? -1 : a > b ? 1 : 0
    })) {
      const { from, nonce } = transaction.decoded
      const expected = (committed.get(from) ?? BigInt(committedAccounts[from] ?? '0')) + 1n
      if (BigInt(nonce) !== expected)
        throw new Error(`Transaction nonce out of sequence for ${from}: expected ${expected}, got ${nonce}`)
      committed.set(from, BigInt(nonce))
    }
  } catch (error) {
    nonceRejection = error
  }
  if (!(nonceRejection instanceof Error) || !nonceRejection.message.startsWith('Transaction nonce out of sequence'))
    throw nonceRejection ?? new Error('Recovery block 14 unexpectedly satisfies protocol 0.6 nonce rules')

  const audit = {
    schema: 1,
    from: version,
    to: PROTOCOL_VERSION,
    anchor: { index: ANCHOR_INDEX, hash: ANCHOR_HASH },
    preservedUnappliedBlock: { index: Number(rejectedBlock.index), hash: targetHash },
    reason: nonceRejection.message
  }
  console.log(JSON.stringify({ status: dryRun ? 'dry-run-valid' : 'validated', ...audit }, null, 2))

  if (!dryRun) {
    try {
      await lstat(backup)
      throw new Error(`Backup path already exists: ${backup}`)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    await mkdir(dirname(backup), { recursive: true, mode: 0o700 })
    await cp(rootReal, backup, { recursive: true, errorOnExist: true, force: false })
    const restrictBackupPermissions = async path => {
      const info = await lstat(path)
      await chmod(path, info.isDirectory() ? 0o700 : 0o600)
      if (info.isDirectory()) {
        for (const child of await readdir(path)) await restrictBackupPermissions(join(path, child))
      }
    }
    await restrictBackupPermissions(backup)

    await chain.batch([
      { type: 'put', key: 'version', value: encode(PROTOCOL_VERSION) },
      { type: 'del', key: 'recoveryTarget' },
      { type: 'put', key: MIGRATION_KEY, value: encode(JSON.stringify(audit)) }
    ])
    if (new TextDecoder().decode(await chain.get('version')) !== PROTOCOL_VERSION ||
      new TextDecoder().decode(await chain.get('lastBlock')) !== ANCHOR_HASH ||
      await chain.has('recoveryTarget') ||
      !(await blocks.get(targetHash)) ||
      !(await chain.get(MIGRATION_KEY)))
      throw new Error('Post-migration verification failed; preserve the backup and ledger root')

    console.log(`Migration complete. Backup: ${backup}`)
    console.log(`Canonical tip remains block 13; block 14 is preserved but not applied.`)
  }
} finally {
  await Promise.all([...stores.values()].map(store => store.close()))
}

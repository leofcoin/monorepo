import { lstat, readdir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import Store from '@leofcoin/storage/store'
import { clearGenesisState, genesisStateStores } from './genesis-state.js'

export const help = `Reset Peach testnet chain data in place, keeping the existing wallet.

  npm run validator:reset                              Preview only
  npm run validator:reset -- --confirm-testnet-reset     Delete old chain data
  npm run validator:reset -- --root <path> --confirm-testnet-reset

Stop all nodes using this root first. Deletes blocks, transactions, pending
transactions, contracts, chainstate, derived nonces and old beacon shares.
NO BACKUP is made. Old balances and history are lost; the bundled genesis is
used at next startup. Account, encrypted wallet and credentials are preserved.
No password is requested, no identity/genesis generated, no node started.

Default root: LEOFCOIN_DATA_ROOT or ~/.leofcoin/peach (same as the validator).
Relative paths are home-relative, not cwd-relative.
`

const ledgerStores = genesisStateStores.map(name => name.slice(0, -'Store'.length))
const exists = async path => {
  try { return await lstat(path) } catch (error) { if (error.code !== 'ENOENT') throw error }
}

export function parseResetOptions(args, env = process.env) {
  const options = { root: env.LEOFCOIN_DATA_ROOT, confirm: false }
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (flag === '--help' || flag === '-h') options.help = true
    else if (flag === '--confirm-testnet-reset') options.confirm = true
    else if (flag === '--root') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('Missing value for --root')
      options.root = value
    } else throw new Error(`Unknown option: ${flag}`)
  }
  if (!options.help && env.LEOFCOIN_NETWORK && env.LEOFCOIN_NETWORK !== 'leofcoin:peach')
    throw new Error('This command supports only the Peach testnet')
  return options
}

export async function resetPlan({ root } = {}) {
  const input = root || '.leofcoin/peach'
  const path = isAbsolute(input) ? resolve(input) : resolve(homedir(), input)
  if (!(await lstat(path)).isDirectory()) throw new Error('Root must be a real directory, not a symlink')
  const source = await realpath(path)
  if ([await realpath(homedir()), sep].includes(source)) throw new Error('Refusing a broad filesystem root')
  const stores = []
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not supported in the data root: ${entry.name}`)
    if (!entry.isDirectory()) continue
    const directory = join(source, entry.name)
    if (!(await exists(join(directory, 'CURRENT')))?.isFile()) {
      if (['account', 'wallet', ...ledgerStores].includes(entry.name)) throw new Error(`Invalid database: ${entry.name}`)
      continue // Unrelated directories/files are never removed.
    }
    for (const file of await readdir(directory, { withFileTypes: true })) {
      if (!file.isFile()) throw new Error(`Unexpected database entry: ${entry.name}/${file.name}`)
    }
    stores.push(entry.name)
  }
  for (const name of ['account', 'wallet'])
    if (!stores.includes(name)) throw new Error(`Required existing identity store missing: ${name}`)
  return { root: source, network: 'leofcoin:peach', stores: stores.sort(),
    clear: ledgerStores.filter(name => stores.includes(name)), preserve: ['account', 'wallet (except old beacon shares)', 'other files and stores'],
    backup: false }
}

async function openStore(root, name) {
  const store = new Store()
  await store.init(name, root, '1', false, false)
  try { await store.db.open({ createIfMissing: false }) }
  catch (error) {
    await store.db.close().catch(() => {})
    throw new Error(`Cannot lock store ${name}; stop all nodes using ${root} first`, { cause: error })
  }
  return store.db
}

const text = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const beaconKey = key => key.startsWith('beacon/private/') || key.startsWith('beacon/public/')
const entries = async (db, keep = () => true) => (await db.iterator().all())
  .filter(([key]) => keep(key)).map(([key, value]) => [key, Buffer.from(value)])
const equal = (before, after) => before.length === after.length &&
  before.every(([key, value], index) => key === after[index][0] && value.equals(after[index][1]))

async function selectedAccount(stores) {
  const wallet = stores.get('wallet')
  const identity = JSON.parse(text(await wallet.get('identity')))
  const publicIdentity = JSON.parse(text(await stores.get('account').get('public')))
  const accounts = JSON.parse(text(await wallet.get('accounts')))
  const account = text(await wallet.get('selected-account'))
  if (!identity || typeof identity.multiWIF !== 'string' || !identity.multiWIF ||
    typeof identity.walletId !== 'string' || !identity.walletId || identity.walletId !== publicIdentity.walletId ||
    !account || !Array.isArray(accounts) || !accounts.some(item => Array.isArray(item) && item.slice(1).includes(account)))
    throw new Error('Incomplete or inconsistent existing identity; reset refused')
  return account
}

export async function resetTestnetData(options = {}) {
  const plan = await resetPlan(options)
  if (!options.confirm) return { mode: 'preview', ...plan }
  const stores = new Map()
  let clearing = false
  try {
    // Native locks are held until every clear and identity check completes.
    // Never reset a live node by deleting its LevelDB files from underneath it.
    for (const name of plan.stores) stores.set(name, await openStore(plan.root, name))
    const account = await selectedAccount(stores)
    const originalAccount = await entries(stores.get('account'))
    const originalWallet = await entries(stores.get('wallet'), key => !beaconKey(key))
    const adapters = Object.fromEntries(ledgerStores.map(name => [`${name}Store`, {
      clear: () => stores.get(name)?.clear() ?? Promise.resolve()
    }]))
    adapters.walletStore = {
      keys: () => stores.get('wallet').keys().all(),
      delete: key => stores.get('wallet').del(key)
    }
    clearing = true
    await clearGenesisState(adapters)
    for (const name of plan.clear) {
      if ((await stores.get(name).keys({ limit: 1 }).all()).length) throw new Error(`Store not empty after reset: ${name}`)
    }
    if (!equal(originalAccount, await entries(stores.get('account'))) ||
      !equal(originalWallet, await entries(stores.get('wallet'))) || await selectedAccount(stores) !== account)
      throw new Error('Wallet preservation verification failed')
    return { mode: 'completed', ...plan, selectedAccount: account,
      notice: 'Old testnet chain data deleted in place, no backup. Same wallet, root and password. Restart uses the bundled genesis.' }
  } catch (error) {
    if (clearing) throw new Error(`Reset incomplete: ${error.message}. Do not start the node; inspect and rerun the reset`, { cause: error })
    throw error
  } finally { await Promise.all([...stores.values()].map(db => db.close())) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseResetOptions(process.argv.slice(2))
    if (options.help) console.log(help)
    else {
      const result = await resetTestnetData(options)
      console.log(JSON.stringify(result, null, 2))
      if (result.mode === 'preview') console.log('\nNothing changed. To delete old chain data, add --confirm-testnet-reset. NO BACKUP.')
      else console.log('\nReset complete. Restart with your usual validator command and the same root/password.\nValidator balances/eligibility now come from the bundled genesis, not the deleted ledger.')
    }
  } catch (error) {
    console.error(`validator:reset: ${error.message}`)
    process.exitCode = 1
  }
}

import Storage from '@leofcoin/storage'
import { clearGenesisState, genesisStateStores } from '../../../../scripts/genesis-state.js'

export const BROWSER_TESTNET_RESET_KEY = 'leofcoin:pending-testnet-reset:v1'

let resetFailure = ''

export function scheduleBrowserTestnetReset({
  network,
  storage = globalThis.sessionStorage,
  location = globalThis.location
} = {}) {
  if ((network || { key: 'peach' }).key !== 'peach')
    throw new Error('Only the local Peach testnet can be reset from the browser.')
  if (!storage || typeof storage.setItem !== 'function' || typeof location?.reload !== 'function')
    throw new Error('Browser reset is unavailable in this environment.')

  storage.setItem(BROWSER_TESTNET_RESET_KEY, 'peach')
  location.reload()
}

const isBeaconKey = key => key.startsWith('beacon/private/') || key.startsWith('beacon/public/')
const walletSnapshot = entries => entries
  .filter(([key]) => !isBeaconKey(key))
  .sort(([left], [right]) => left.localeCompare(right))
const snapshotsEqual = (left, right) => left.length === right.length &&
  left.every(([key, value], index) => key === right[index][0] && value.length === right[index][1].length &&
    value.every((byte, byteIndex) => byte === right[index][1][byteIndex]))

export function getBrowserTestnetResetFailure() {
  return resetFailure
}

export async function completePendingBrowserTestnetReset({
  storage = globalThis.sessionStorage,
  StorageClass = Storage
} = {}) {
  const pending = storage?.getItem(BROWSER_TESTNET_RESET_KEY)
  if (pending === null || pending === undefined) return false
  if (pending !== 'peach') throw new Error('Unknown browser testnet reset request; reset refused.')

  resetFailure = ''
  try {
    const stores = {}
    for (const storeName of genesisStateStores) {
      const name = `${storeName.slice(0, -'Store'.length)}-peach`
      const store = new StorageClass(name, '.leofcoin/peach')
      await store.init()
      stores[storeName] = store
    }

    const walletStore = new StorageClass('wallet', '.leofcoin/wallet')
    await walletStore.init()
    stores.walletStore = walletStore
    const originalWallet = walletSnapshot(await walletStore.entries())

    await clearGenesisState(stores)

    for (const storeName of genesisStateStores) {
      if ((await stores[storeName].keys()).length)
        throw new Error(`Store not empty after reset: ${stores[storeName].name}`)
    }
    if (!snapshotsEqual(originalWallet, walletSnapshot(await walletStore.entries())))
      throw new Error('Wallet preservation verification failed')

    storage.removeItem(BROWSER_TESTNET_RESET_KEY)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    resetFailure = `Browser Peach testnet reset incomplete: ${message}. Keep the wallet locked and reload to retry.`
    throw new Error(resetFailure, { cause: error })
  }
}

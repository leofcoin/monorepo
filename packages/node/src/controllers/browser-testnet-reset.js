import { completePendingStorageMaintenance, getStorageMaintenanceFailure } from './browser-storage.js'

// Keep existing login/node-activity links compatible with the Settings workflow.
export const BROWSER_TESTNET_RESET_KEY = 'leofcoin:pending-testnet-reset:v1'
export const getBrowserTestnetResetFailure = getStorageMaintenanceFailure

export function scheduleBrowserTestnetReset({ network, storage = globalThis.sessionStorage, location = globalThis.location } = {}) {
  if ((network || { key: 'peach' }).key !== 'peach') throw new Error('Only the local Peach testnet can be reset from the browser.')
  if (!storage?.setItem || !location?.reload) throw new Error('Browser reset is unavailable in this environment.')
  storage.setItem(BROWSER_TESTNET_RESET_KEY, 'peach')
  location.reload()
}

export async function completePendingBrowserTestnetReset(options = {}) {
  const storage = options.storage ?? globalThis.sessionStorage
  const pending = storage?.getItem(BROWSER_TESTNET_RESET_KEY)
  const completed = await completePendingStorageMaintenance({ ...options, storage,
    legacyRequest: pending === 'peach' ? { version: 1, action: 'chain', networkKey: 'peach' }
      : pending !== null && pending !== undefined ? { version: 0 } : undefined })
  if (completed) storage?.removeItem(BROWSER_TESTNET_RESET_KEY)
  return completed
}

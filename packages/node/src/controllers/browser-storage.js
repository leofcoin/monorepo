import Storage from '@leofcoin/storage'
import { SUPPORTED_NETWORKS } from '../network-selection.js'
import { genesisStateStores } from '../../../../scripts/genesis-state.js'

export const STORAGE_REQUEST_KEY = 'leofcoin:storage-request:v1'
export const STORAGE_DIRTY_KEY = 'leofcoin:storage-incomplete:v1'
export const STORAGE_LOCK = 'leofcoin:browser-storage:v1'
let failure = ''
let nodeLease

export function storageOperation(action, networkKey) {
  if (!Object.hasOwn(SUPPORTED_NETWORKS, networkKey)) throw new Error('Unsupported storage network')
  if (!['chain', 'pool'].includes(action)) throw new Error('Unsupported storage operation')
  const network = SUPPORTED_NETWORKS[networkKey]
  const names = action === 'chain' ? genesisStateStores.map(name => name.slice(0, -5)) : ['transactionPool']
  return { version: 1, action, networkKey, network: network.network, root: network.storageRoot,
    stores: names.map(name => `${name}-${networkKey}`) }
}

function parseRequest(value) {
  const record = typeof value === 'string' ? JSON.parse(value) : value
  if (record?.version !== 1) throw new Error('Invalid storage request')
  return storageOperation(record.action, record.networkKey) // Never accept caller-supplied store names.
}
const record = operation => JSON.stringify({ version: 1, action: operation.action, networkKey: operation.networkKey })
export const getStorageMaintenanceFailure = () => failure

export function scheduleStorageMaintenance({ action, networkKey, storage = globalThis.sessionStorage,
  persistentStorage = globalThis.localStorage, location = globalThis.location } = {}) {
  const operation = storageOperation(action, networkKey)
  if (!storage?.setItem || !location?.reload) throw new Error('Browser storage management is unavailable')
  const dirty = persistentStorage?.getItem(STORAGE_DIRTY_KEY)
  if (dirty && record(parseRequest(dirty)) !== record(operation))
    throw new Error('Another storage operation is incomplete. Reload to finish it before choosing a different action.')
  const previous = storage.getItem(STORAGE_REQUEST_KEY)
  storage.setItem(STORAGE_REQUEST_KEY, record(operation))
  try { location.reload() } // Terminate this document's chain/workers before touching their stores.
  catch (error) {
    if (previous === null) storage.removeItem(STORAGE_REQUEST_KEY)
    else storage.setItem(STORAGE_REQUEST_KEY, previous)
    throw error
  }
}

async function exclusive(locks, run) {
  if (!locks?.request) throw new Error('Safe storage locking is unavailable in this browser')
  return locks.request(STORAGE_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
    if (!lock) throw new Error('Close the other Leofcoin node tabs, then reload to retry. No data was changed.')
    return run()
  })
}

// Hold a shared lease for the lifetime of the document. Browser context teardown
// releases it automatically, including reload/crash. Do not release on pagehide:
// a bfcache-restored document could otherwise resume writers without a lease.
export async function acquireBrowserStorageLease({ locks = globalThis.navigator?.locks,
  storage = globalThis.sessionStorage, persistentStorage = globalThis.localStorage } = {}) {
  if (failure || storage?.getItem(STORAGE_REQUEST_KEY) || persistentStorage?.getItem(STORAGE_DIRTY_KEY))
    throw new Error(failure || 'Storage maintenance is incomplete; reload before starting the node')
  if (!nodeLease) {
    nodeLease = new Promise((resolve, reject) => {
      if (!locks?.request) { reject(new Error('Safe storage locking is unavailable in this browser')); return }
      locks.request(STORAGE_LOCK, { mode: 'shared', ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Storage maintenance is active in another tab. Wait, then reload.')
        if (persistentStorage?.getItem(STORAGE_DIRTY_KEY) || storage?.getItem(STORAGE_REQUEST_KEY))
          throw new Error('Storage maintenance is incomplete; reload before starting the node')
        resolve(true)
        await new Promise(() => {})
      }).catch(reject)
    })
  }
  return nodeLease
}

const isTargetBeacon = (key, network) => key.startsWith(`beacon/private/${network}/`) || key.startsWith(`beacon/public/${network}/`)
const snapshot = entries => entries.map(([key, value]) => [key, new Uint8Array(value)])
  .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
const equal = (left, right) => left.length === right.length && left.every(([key, value], index) =>
  key === right[index][0] && value.length === right[index][1].length && value.every((byte, at) => byte === right[index][1][at]))

export async function completePendingStorageMaintenance({ storage = globalThis.sessionStorage,
  persistentStorage = globalThis.localStorage, locks = globalThis.navigator?.locks,
  StorageClass = Storage, legacyRequest } = {}) {
  const pending = storage?.getItem(STORAGE_REQUEST_KEY)
  const dirty = persistentStorage?.getItem(STORAGE_DIRTY_KEY)
  if (!pending && !dirty && !legacyRequest) return false
  failure = ''
  try {
    const operation = parseRequest(dirty || pending || legacyRequest)
    for (const value of [pending, legacyRequest].filter(Boolean)) {
      if (record(parseRequest(value)) !== record(operation)) throw new Error('Conflicting storage requests; finish the incomplete operation first')
    }
    if (!persistentStorage?.setItem || !persistentStorage?.removeItem) throw new Error('Persistent reset journal is unavailable; nothing cleared')
    await exclusive(locks, async () => {
      const current = persistentStorage.getItem(STORAGE_DIRTY_KEY)
      if (current && record(parseRequest(current)) !== record(operation)) throw new Error('Another storage operation is incomplete; finish it first')
      const stores = []
      for (const name of operation.stores) {
        const store = new StorageClass(name, operation.root)
        await store.init(); stores.push(store)
      }
      let wallet, before
      if (operation.action === 'chain') {
        wallet = new StorageClass('wallet', '.leofcoin/wallet'); await wallet.init()
        before = snapshot((await wallet.entries()).filter(([key]) => !isTargetBeacon(key, operation.network)))
      }
      // Every tab checks this origin-wide journal before starting a writer. A
      // crash/partial clear therefore cannot turn an inconsistent root into a node.
      persistentStorage.setItem(STORAGE_DIRTY_KEY, record(operation))
      const results = await Promise.allSettled(stores.map(store => store.clear()))
      const errors = results.filter(result => result.status === 'rejected')
      if (errors.length) throw new Error(errors.map(result => result.reason?.message || String(result.reason)).join('; '))
      for (const store of stores) if ((await store.keys()).length) throw new Error(`Store not empty after clearing: ${store.name}`)
      if (wallet) {
        for (const key of await wallet.keys()) if (isTargetBeacon(key, operation.network)) await wallet.delete(key)
        if (!equal(before, snapshot(await wallet.entries()))) throw new Error('Wallet preservation verification failed')
      }
      persistentStorage.removeItem(STORAGE_DIRTY_KEY)
      storage?.removeItem(STORAGE_REQUEST_KEY)
    })
    return true
  } catch (error) {
    failure = `Browser storage operation incomplete: ${error?.message || error}. Keep the node stopped and reload to retry.`
    throw new Error(failure, { cause: error })
  }
}

export async function browserStorageOverview({ networkKey, navigator = globalThis.navigator, limit = 10000 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Storage scan limit must be between 1 and 10000')
  const operation = storageOperation('chain', networkKey)
  const validBytes = value => Number.isSafeInteger(value) && value >= 0 ? value : null
  const result = { usage: null, quota: null, stores: [], bytes: 0, incomplete: false, warnings: [] }
  try {
    const estimate = await navigator?.storage?.estimate?.() || {}
    result.usage = validBytes(estimate.usage); result.quota = validBytes(estimate.quota)
  } catch { result.warnings.push('The browser storage estimate is unavailable.') }
  let root
  try { root = await navigator.storage.getDirectory() }
  catch { return { ...result, bytes: null, incomplete: true, warnings: [...result.warnings, 'Local store sizes are unavailable in this browser.'] } }
  for (const name of operation.stores) {
    let count = 0, bytes = 0, truncated = false, incomplete = false
    try {
      const store = await root.getDirectoryHandle(name, { create: false })
      // Metadata only: never load record contents or open the wallet. Limit work
      // per store, even on a very large chain. This is a live, non-atomic sample.
      for await (const handle of store.values()) {
        count++
        try {
          const size = handle.kind === 'file' ? validBytes((await handle.getFile()).size) : null
          if (size === null || !Number.isSafeInteger(bytes + size)) incomplete = true
          else bytes += size
        } catch { incomplete = true } // A live writer may have deleted the file.
        if (count >= limit) { truncated = true; break }
      }
    } catch (error) { if (error.name !== 'NotFoundError') incomplete = true }
    result.stores.push({ name, count, bytes, truncated, incomplete })
    result.bytes += bytes
    result.incomplete ||= truncated || incomplete
  }
  return result
}

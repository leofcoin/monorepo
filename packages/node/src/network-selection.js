export const NETWORK_STORAGE_KEY = 'leofcoin:selected-network:v1'

export const SUPPORTED_NETWORKS = Object.freeze({
  mainnet: Object.freeze({
    key: 'mainnet',
    network: 'leofcoin:mainnet',
    networkVersion: 'mainnet',
    label: 'Mainnet (experimental)',
    storageRoot: '.leofcoin/mainnet'
  }),
  peach: Object.freeze({
    key: 'peach',
    network: 'leofcoin:peach',
    networkVersion: 'peach',
    label: 'Peach testnet',
    storageRoot: '.leofcoin/peach'
  })
})

export function getNetwork(key) {
  return SUPPORTED_NETWORKS[key] || SUPPORTED_NETWORKS.peach
}

export function getSelectedNetwork(storage = globalThis.localStorage) {
  return getNetwork(storage?.getItem(NETWORK_STORAGE_KEY) || 'peach')
}

export function setSelectedNetwork(key, storage = globalThis.localStorage) {
  const network = SUPPORTED_NETWORKS[key]
  if (!network) throw new Error(`Unsupported network: ${key}`)
  storage.setItem(NETWORK_STORAGE_KEY, key)
  return network
}

function getNodePeerId(network, storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new Error('Persistent storage is required for a unique Peernet routing identity.')
  const storageKey = `leofcoin:peernet-peer-id:v1:${network}`
  const saved = storage.getItem(storageKey)
  if (saved !== null) {
    if (!/^lfc-peer-[0-9a-f]{32}$/.test(saved))
      throw new Error('Saved Peernet routing identity is invalid.')
    return saved
  }
  if (!globalThis.crypto?.getRandomValues)
    throw new Error('Secure randomness is unavailable for Peernet routing identity.')
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const id = `lfc-peer-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  storage.setItem(storageKey, id)
  return id
}

export function installNetworkStoreScope(key, global = globalThis) {
  const network = SUPPORTED_NETWORKS[key]
  if (!network) throw new Error(`Unsupported network: ${key}`)
  const Peernet = global.Peernet
  if (typeof Peernet !== 'function') throw new Error('Peernet is not available for network store isolation')
  if (Peernet.networkStoreScope === key) return
  if (Peernet.networkStoreScope) throw new Error('Peernet stores are already scoped to another network')

  class NetworkScopedPeernet extends Peernet {
    constructor(options, password) {
      super({ ...options, routingId: getNodePeerId(key, global.localStorage) }, password)
    }

    get id() {
      return this.routingId || getNodePeerId(key, global.localStorage)
    }

    get peerId() {
      return this.identity?.id
    }

    set peerId(_value) {}

    async addStore(name, prefix, root, isPrivate = true) {
      const storeName = name === 'wallet' ? name : `${name}-${key}`
      const storeIsPrivate = ['block', 'transaction', 'chain', 'data', 'message', 'share'].includes(name)
        ? false
        : isPrivate
      await super.addStore(storeName, prefix, root, storeIsPrivate)
      if (storeName !== name) {
        global[`${name}Store`] = global[`${storeName}Store`]
        const index = this.stores.lastIndexOf(storeName)
        if (index !== -1) this.stores[index] = name
      }
    }
  }
  Object.defineProperty(NetworkScopedPeernet, 'networkStoreScope', { value: key })
  global.Peernet = NetworkScopedPeernet
}

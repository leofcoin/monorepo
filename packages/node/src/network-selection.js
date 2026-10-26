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

export function installNetworkStoreScope(key, global = globalThis) {
  const network = SUPPORTED_NETWORKS[key]
  if (!network) throw new Error(`Unsupported network: ${key}`)
  const Peernet = global.Peernet
  if (typeof Peernet !== 'function') throw new Error('Peernet is not available for network store isolation')
  if (Peernet.networkStoreScope === key) return
  if (Peernet.networkStoreScope) throw new Error('Peernet stores are already scoped to another network')

  class NetworkScopedPeernet extends Peernet {
    constructor(options, password) {
      super({ ...options, routingId: undefined }, password)
    }

    get id() {
      return this.identity?.id
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

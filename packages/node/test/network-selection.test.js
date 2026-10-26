import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNetwork,
  getSelectedNetwork,
  installNetworkStoreScope,
  NETWORK_STORAGE_KEY,
  setSelectedNetwork,
  SUPPORTED_NETWORKS
} from '../src/network-selection.js'

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  }
}

test('supports both networks and keeps Peach as the default', () => {
  assert.equal(getSelectedNetwork(memoryStorage()).key, 'peach')
  assert.equal(getNetwork('mainnet').network, 'leofcoin:mainnet')
  assert.equal(getNetwork('peach').network, 'leofcoin:peach')
  assert.equal(getNetwork('invalid').key, 'peach')
})

test('persists only supported network selections', () => {
  const storage = memoryStorage()
  assert.equal(setSelectedNetwork('mainnet', storage), SUPPORTED_NETWORKS.mainnet)
  assert.equal(storage.getItem(NETWORK_STORAGE_KEY), 'mainnet')
  assert.equal(getSelectedNetwork(storage).key, 'mainnet')
  assert.throws(() => setSelectedNetwork('unknown', storage), /Unsupported network/)
  assert.equal(storage.getItem(NETWORK_STORAGE_KEY), 'mainnet')
})

test('uses separate roots for network state and shared wallet data', () => {
  assert.notEqual(SUPPORTED_NETWORKS.mainnet.storageRoot, SUPPORTED_NETWORKS.peach.storageRoot)
})

test('shares the wallet Peernet ID across devices and scopes every store except the wallet', async () => {
  const created = []
  let storeGlobal
  class Peernet {
    stores = []
    identity = { id: 'wallet-identity-id' }
    constructor(options = {}) {
      this.routingId = options.routingId
    }
    get id() {
      return this.routingId || this.identity.id
    }
    get peerId() {
      return this.identity.id
    }
    async addStore(name, prefix, root, isPrivate) {
      created.push([name, prefix, root, isPrivate])
      storeGlobal[`${name}Store`] = { name }
      if (!isPrivate) this.stores.push(name)
    }
  }
  const nodeGlobal = { Peernet, localStorage: memoryStorage() }
  storeGlobal = nodeGlobal
  try {
    installNetworkStoreScope('mainnet', nodeGlobal)
    const node = new nodeGlobal.Peernet({ routingId: 'ignored-custom-routing-id' })
    const secondNode = new nodeGlobal.Peernet()
    assert.equal(node.id, 'wallet-identity-id')
    assert.equal(node.id, secondNode.id)
    assert.equal(node.peerId, 'wallet-identity-id')
    assert.equal(node.id, node.peerId)
    assert.equal(node.routingId, undefined)
    const otherDeviceGlobal = { Peernet, localStorage: memoryStorage() }
    installNetworkStoreScope('mainnet', otherDeviceGlobal)
    assert.equal(node.id, new otherDeviceGlobal.Peernet().id)
    const peachGlobal = { Peernet, localStorage: nodeGlobal.localStorage }
    installNetworkStoreScope('peach', peachGlobal)
    assert.equal(node.id, new peachGlobal.Peernet().id)
    await node.addStore('block', 'lfc', '.leofcoin/mainnet', false)
    await node.addStore('wallet', 'lfc', '.leofcoin/wallet', true)
    assert.equal(nodeGlobal.blockStore.name, 'block-mainnet')
    assert.equal(nodeGlobal.walletStore.name, 'wallet')
    assert.deepEqual(created.map(([name]) => name), ['block-mainnet', 'wallet'])
    assert.deepEqual(node.stores, ['block'])
    assert.throws(() => installNetworkStoreScope('peach', nodeGlobal), /already scoped/)
  } finally {
    delete nodeGlobal.blockStore
    delete nodeGlobal['block-mainnetStore']
    delete nodeGlobal.walletStore
  }
})

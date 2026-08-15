export const genesisStateStores = [
  'blockStore',
  'chainStore',
  'stateStore',
  'transactionPoolStore',
  'contractStore',
  'transactionStore',
  'accountsStore'
]

export const clearGenesisState = async (stores = globalThis) => {
  await Promise.all(
    genesisStateStores.map((name) => {
      const store = stores[name]
      if (!store || typeof store.clear !== 'function') {
        throw new Error(`genesis state store is unavailable: ${name}`)
      }
      return store.clear()
    })
  )

  const walletStore = stores.walletStore
  if (!walletStore || typeof walletStore.keys !== 'function' || typeof walletStore.delete !== 'function') {
    throw new Error('genesis state store is unavailable: walletStore')
  }
  for (const key of await walletStore.keys()) {
    if (key.startsWith('beacon/private/') || key.startsWith('beacon/public/')) await walletStore.delete(key)
  }
}

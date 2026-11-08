import { newRoutingId, validateRoutingId, routingScope } from './routing-identity.js'

/** One factory per document; injectable storage/locks for isolated tests. */
export function createBrowserRoutingIdentity({ storage = globalThis.localStorage,
  locks = globalThis.navigator?.locks, crypto = globalThis.crypto } = {}) {
  const loaded = new Map<string, Promise<string>>()
  return (config): Promise<string> => {
    const scope = `${routingScope(config)}:${config.routingAccount || 'default'}`
    if (loaded.has(scope)) return loaded.get(scope)
    const result = (async () => {
      if (!locks?.request || !storage) throw new Error('Persistent storage and Web Locks are required for a safe node routing identity')
      const key = `leofcoin:node-routing:v1:${scope}`
      return locks.request(key, { mode: 'exclusive' }, async () => {
        if (config.routingId !== undefined) return validateRoutingId(config.routingId)
        const stored = storage.getItem(key)
        if (stored !== null) return validateRoutingId(stored)
        const id = newRoutingId(crypto)
        storage.setItem(key, id)
        return id
      })
    })()
    loaded.set(scope, result)
    result.catch(() => { if (loaded.get(scope) === result) loaded.delete(scope) })
    return result
  }
}

let resolveIdentity
export function browserRoutingId(config): Promise<string> {
  resolveIdentity ||= createBrowserRoutingIdentity()
  return resolveIdentity(config)
}

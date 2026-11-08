/** Transport identity only: never derive accounts, keys or voting power from it. */
export function newRoutingId(crypto = globalThis.crypto): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `lfc-peer-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function validateRoutingId(id: unknown): string {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(id))
    throw new Error('Invalid node routing ID; refusing to replace stored node metadata')
  return id
}

export function nodeDataRoot(config: { root?: string; network?: string; storeNamespace?: string }): string {
  if (config.root) return config.root
  const [network, version] = (config.network || 'leofcoin:peach').split(':')
  const root = version ? `.${network}/${version}` : `.${network}`
  return config.storeNamespace ? `${root}/${config.storeNamespace}` : root
}

export function routingScope(config): string {
  return `${config.network || 'leofcoin:peach'}:${nodeDataRoot(config)}`
}

export const KNOWN_CHAINS = Object.freeze({
  'lfc:8a6f0e72d3366bbf579e91dc7bcd716f02763511cee2f05a3b65429a6b400f18': 'Peach testnet'
})

export const chainNameForId = (chainId) => KNOWN_CHAINS[chainId]

export const shortChainId = (chainId) => {
  if (!chainId) return ''
  return `${chainId.slice(0, 14)}…${chainId.slice(-8)}`
}

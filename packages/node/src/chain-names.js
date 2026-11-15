export const KNOWN_NETWORKS = Object.freeze({
  'leofcoin:mainnet': 'Mainnet (experimental)',
  'leofcoin:peach': 'Peach testnet'
})

export const chainNameForIdentity = identity => KNOWN_NETWORKS[identity?.network]

export const shortChainId = (chainId) => {
  if (!chainId) return ''
  return `${chainId.slice(0, 14)}…${chainId.slice(-8)}`
}

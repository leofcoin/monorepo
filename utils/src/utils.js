export const networksByVersion = {
  1: 'mainnet',
  3: 'ropsten',
  42: 'kovan',
  7475: 'wapnet'
}

export const networksByName = {
  mainnet: 1,
  ropsten: 3,
  kovan: 42,
  wapnet: 7475
}

export const networkNameFor = version => {
  return networksByVersion[version]
}

export const networkVersionFor = name => {
  return networksByName[name]
}

export const isValidNetwork = network => {
  if (!network.version) return false
  if (!network.name) return false
  if (typeof network.name !== 'string') return false
  if (isNaN(Number(network.version))) return false
  if (networkVersionFor(network.name) !== network.version) return false
  if (networkNameFor(network.version) !== network.name) return false

  return true
}

/**
 * @param {String | Number} - network
 */
export const networkFor = network => {
  if (typeof network === 'object' && isValidNetwork(network)) return network

  if (isNaN(Number(network))) {
    const version = networksByName[network]
    return {
      name: network,
      version
    }
  }
  const name = networksByVersion[network]
  return {
    name,
    version: network
  }
}

export default {
  networkFor,
  networkNameFor,
  networkVersionFor,
  networksByName,
  networksByVersion,
  isValidNetwork
}

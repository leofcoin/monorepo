import subtle from './subtle.js'

/**
 * Hashes the created hash again
 * ```js
 * const {createDoubleHash} = await import('@leofcoin/crypto')
 * createDoubleHash(data, algorithm)
 * ```
 * @param {Uint8Array} data 
 * @param {string} algorithm 
 * @returns Uint8Array
 */
const createDoubleHash = async (data, algorithm = 'SHA-512') =>
  subtle.digest(algorithm, await subtle.digest(algorithm, data))

export { createDoubleHash as default }
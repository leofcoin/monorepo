import subtle from './subtle.js'

/**
 * ```js
 * const {createHash} = await import('@leofcoin/crypto')
 * createHash(data, algorithm)
 * ```
 * @param {Uint8Array} data 
 * @param {string} algorithm 
 * @returns Uint8Array
 */
const createHash = (data, algorithm = 'SHA-512') => subtle.digest(algorithm, data)

export { createHash as default }
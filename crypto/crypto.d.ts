import { webcrypto } from "crypto"

declare module '@leofcoin/crypto' {
  export function generatePbkdf2(password: Uint8Array): Promise<webcrypto.CryptoKey>

  /** 
   * The `iterations` argument must be a number set as high as possible. The
   * higher the number of iterations, the more secure the derived key will be,
   * but will take a longer amount of time to complete.
   *
   * The `salt` should be as unique as possible. It is recommended that a salt is
   * random and at least 16 bytes long. See [NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) for details.
   *
   * When passing strings for `password` or `salt`, please consider `caveats when using strings as inputs to cryptographic APIs`.
   *
   * ```js
   * const {
   *   pbkdf2
   * } = await import('@leofcoin/utils');
   *
   * const bits = await pbkdf2(secret, salt, 100000, 64, 'SHA-512')
   * ```
   * @param {Uint8Array} password 
   * @param {Uint8Array} salt 
   * @param {Number} iterations 
   * @param {Number} length 
   * @returns {uint8Array}
   */
  export function pbkdf2(password: Uint8Array, salt: Uint8Array, iterations: 4096, length: 64, algorithm: 'SHA-512'): Promise<Uint8Array>
}
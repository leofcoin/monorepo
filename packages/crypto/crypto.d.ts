import { webcrypto } from "crypto"

declare type digestSupportedAlgorithm = 'SHA-1' | 'SHA-256' |'SHA-384' | 'SHA-512'
declare type pkdf2SupportedAlgorithm = digestSupportedAlgorithm
declare type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Uint8ClampedArray | BigUint64Array | BigInt64Array

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
  export function pbkdf2(password: ArrayBuffer | TypedArray, salt: Uint8Array, iterations: number, length: number, algorithm: pkdf2SupportedAlgorithm): Promise<Uint8Array>

  /**
   * ```js
   * const { randombytes } = await import('@leofcoin/utils')
   * 
   * const bytes = randombytes(256)
   * ```
   * @param {number} strength length of the to generate Uint8array
   * @returns Uint8Array
   */
  export function randombytes(strength: number):Uint8Array

  export function createHash (data: Uint8Array, algorithm: digestSupportedAlgorithm): Promise<Uint8Array>
  export function createDoubleHash (data: Uint8Array, algorithm: digestSupportedAlgorithm): Promise<Uint8Array>
}
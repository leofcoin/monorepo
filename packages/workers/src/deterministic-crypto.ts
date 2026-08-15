import { sha256 } from '@noble/hashes/sha256'

const encoder = new TextEncoder()
const INTEGER_ARRAYS = new Set([
  'BigInt64Array',
  'BigUint64Array',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array'
])

const counterBytes = (counter: bigint) => {
  const bytes = new Uint8Array(8)
  const view = new DataView(bytes.buffer)
  view.setBigUint64(0, counter, false)
  return bytes
}

const concatenate = (left: Uint8Array, right: Uint8Array) => {
  const output = new Uint8Array(left.length + right.length)
  output.set(left)
  output.set(right, left.length)
  return output
}

const asBytes = (value: ArrayBufferView) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

/**
 * Synchronous Web Crypto subset backed by a deterministic SHA-256 stream.
 * The seed must come from finalized consensus data plus the execution identity.
 */
export class DeterministicCrypto {
  #counter = 0n
  readonly #seed: Uint8Array

  constructor(seed: string) {
    if (!seed) throw new TypeError('deterministic crypto seed is required')
    this.#seed = sha256(encoder.encode(`leofcoin-contract-random-v1:${seed}`))
  }

  #fill(output: Uint8Array) {
    let offset = 0
    while (offset < output.length) {
      const block = sha256(concatenate(this.#seed, counterBytes(this.#counter)))
      this.#counter += 1n
      const length = Math.min(block.length, output.length - offset)
      output.set(block.subarray(0, length), offset)
      offset += length
    }
  }

  getRandomValues<T extends ArrayBufferView>(array: T): T {
    const name = array?.constructor?.name
    if (!name || !INTEGER_ARRAYS.has(name)) {
      throw new TypeError('crypto.getRandomValues requires an integer TypedArray')
    }
    if (array.byteLength > 65_536) throw new TypeError('crypto.getRandomValues quota exceeded')
    this.#fill(asBytes(array))
    return array
  }

  randomUUID(): string {
    const bytes = this.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}

export const createCryptoBridge = (resolve: () => DeterministicCrypto | undefined) =>
  Object.freeze({
    getRandomValues: <T extends ArrayBufferView>(array: T) => {
      const crypto = resolve()
      if (!crypto) throw new Error('contract crypto requires finalized beacon randomness')
      return crypto.getRandomValues(array)
    },
    randomUUID: () => {
      const crypto = resolve()
      if (!crypto) throw new Error('contract crypto requires finalized beacon randomness')
      return crypto.randomUUID()
    }
  })

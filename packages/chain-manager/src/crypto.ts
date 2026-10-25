import { sha256 } from '@noble/hashes/sha2.js'

// multi-signature imports Node's synchronous hash API even for public plans.
export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`Unsupported hash algorithm: ${algorithm}`)
  const hash = sha256.create()
  return {
    update(data: string | Uint8Array) {
      hash.update(typeof data === 'string' ? new TextEncoder().encode(data) : data)
      return this
    },
    digest() { return hash.digest() }
  }
}

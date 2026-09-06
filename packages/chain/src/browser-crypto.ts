import { sha256 } from '@noble/hashes/sha2.js'

const encoder = new TextEncoder()

const normalizeInput = (value: string | ArrayBuffer | ArrayBufferView): Uint8Array => {
  if (typeof value === 'string') return encoder.encode(value)
  if (value instanceof Uint8Array) return value
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return new Uint8Array(value)
}

const createHash = (algorithm: string) => {
  if (algorithm !== 'sha256') throw new Error(`Unsupported hash algorithm: ${algorithm}`)
  const chunks: Uint8Array[] = []

  return {
    update(data: string | ArrayBuffer | ArrayBufferView) {
      chunks.push(normalizeInput(data))
      return this
    },
    digest() {
      const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
      const input = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        input.set(chunk, offset)
        offset += chunk.length
      }
      return sha256(input)
    }
  }
}

const randomBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size))

const timingSafeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) throw new Error('Inputs must have the same length')
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

const webcrypto = globalThis.crypto

export { createHash, randomBytes, timingSafeEqual, webcrypto }
export default { createHash, randomBytes, timingSafeEqual, webcrypto }

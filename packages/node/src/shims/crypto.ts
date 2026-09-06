import { sha256 } from '@noble/hashes/sha2.js'

const encoder = new TextEncoder()

const concatUint8Arrays = (parts: Uint8Array[]): Uint8Array => {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const normalizeInput = (value: string | ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array => {
  if (typeof value === 'string') return encoder.encode(value)
  if (value instanceof Uint8Array) return value
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return new Uint8Array(value)
}

const createHash = (algorithm: string) => {
  if (algorithm !== 'sha256') {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`)
  }

  const chunks: Uint8Array[] = []

  return {
    update(data: string | ArrayBuffer | ArrayBufferView | Uint8Array) {
      chunks.push(normalizeInput(data))
      return this
    },
    digest() {
      return sha256(concatUint8Arrays(chunks))
    }
  }
}

const randomBytes = (size: number) => {
  const buffer = new Uint8Array(size)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buffer)
  } else {
    for (let i = 0; i < size; i += 1) {
      buffer[i] = Math.floor(Math.random() * 256)
    }
  }
  return buffer
}

const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) {
    throw new Error('Inputs must have the same length')
  }
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

const webcrypto = globalThis.crypto

export { createHash, randomBytes, timingSafeEqual, webcrypto }
export default { createHash, randomBytes, timingSafeEqual, webcrypto }

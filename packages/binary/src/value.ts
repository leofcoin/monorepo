import { BinaryReader, varUintLength, varBigIntLength } from './framing.js'

export interface ValueLimits { maxBytes?: number; maxDepth?: number; maxNodes?: number }
export const BINARY_CONTENT_TYPE = 'application/octet-stream'
const MAGIC = new Uint8Array([0x4c, 0x46, 0x43, 1])
const utf8 = new TextEncoder()
const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const defaults = { maxBytes: 16 * 1024 * 1024, maxDepth: 64, maxNodes: 200000 }
const BIGINT_LIMB = 1n << 49n
const BIGINT_MASK = BIGINT_LIMB - 1n
const limitsFor = (options: ValueLimits) => {
  const limits = { ...defaults, ...options }
  for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Invalid binary limits')
  return limits
}

/** Canonical UTF-8 length without allocating a temporary encoded string. */
function stringLength(value: string, maximum: number): number {
  if (value.length > maximum) throw new RangeError('Invalid binary string')
  let length = value.length
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x80) continue
    if (code < 0x800) { length++; continue }
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = value.charCodeAt(++index)
      if (!(low >= 0xdc00 && low <= 0xdfff)) throw new RangeError('Invalid binary string')
      length += 2
    } else {
      if (code >= 0xdc00 && code <= 0xdfff) throw new RangeError('Invalid binary string')
      length += 2
    }
  }
  return length
}

/** Versioned canonical typed values. Validation/planning allocates no byte buffers. */
export function encodeValue(value: unknown, options: ValueLimits = {}): Uint8Array {
  return encodeValueWithPrefix(value, EMPTY, options)
}

const EMPTY = new Uint8Array()

/** Prepend an existing framing/codec header in the same allocation.
 * maxBytes bounds the typed value (including MAGIC), as with encodeValue.
 * The caller-owned prefix is separate framing and is copied, never retained.
 */
export function encodeValueWithPrefix(value: unknown, prefix: Uint8Array, options: ValueLimits = {}): Uint8Array {
  if (!(prefix instanceof Uint8Array)) throw new TypeError('Expected Uint8Array prefix')
  const limits = limitsFor(options)
  // Flat plan retains validated data-property values; writing never reads user properties again.
  // Internal tag 11 is an untagged map key and is never emitted on the wire.
  const plan: any[] = []
  const ancestors = new Set<object>()
  let size = MAGIC.length
  let nodes = 0
  const reserve = (length: number) => {
    size += length
    if (size > limits.maxBytes) throw new RangeError('Binary value exceeds byte limit')
  }
  const string = (value: string, tag: number) => {
    const length = stringLength(value, limits.maxBytes)
    reserve((tag === 7 ? 1 : 0) + varUintLength(length) + length)
    plan.push(tag, value, length)
  }
  const visit = (value: unknown, depth: number) => {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) throw new RangeError('Binary value exceeds complexity limit')
    if (value === undefined || value === null || typeof value === 'boolean') {
      reserve(1)
      plan.push(value === undefined ? 0 : value === null ? 1 : value === false ? 2 : 3)
      return
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('Binary numbers must be finite')
      reserve(9); plan.push(4, value); return
    }
    if (typeof value === 'bigint') {
      const magnitude = value < 0n ? -value : value
      reserve(1 + varBigIntLength(magnitude))
      plan.push(value < 0n ? 6 : 5, magnitude)
      return
    }
    if (typeof value === 'string') return string(value, 7)
    if (value instanceof Uint8Array) {
      reserve(1 + varUintLength(value.length) + value.length)
      plan.push(8, value, value.length)
      return
    }
    if (typeof value !== 'object') throw new TypeError('Unsupported binary value')
    if (ancestors.has(value)) throw new TypeError('Cyclic binary value')
    ancestors.add(value)
    try {
      if (Array.isArray(value)) {
        if (value.length > limits.maxNodes - nodes) throw new RangeError('Binary array exceeds node limit')
        if (Object.keys(value).length !== value.length || Object.getOwnPropertySymbols(value).length)
          throw new TypeError('Binary arrays cannot have extra properties or holes')
        reserve(1 + varUintLength(value.length)); plan.push(9, value.length)
        for (let index = 0; index < value.length; index++) {
          const entry = Object.getOwnPropertyDescriptor(value, String(index))
          if (!entry || !('value' in entry)) throw new TypeError('Sparse arrays and accessors are not binary values')
          visit(entry.value, depth + 1)
        }
      } else {
        const prototype = Object.getPrototypeOf(value)
        if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Binary maps must be plain objects')
        const keys = Object.keys(value).sort()
        if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Symbol keys are not binary values')
        if (keys.length > limits.maxNodes - nodes) throw new RangeError('Binary map exceeds node limit')
        reserve(1 + varUintLength(keys.length)); plan.push(10, keys.length)
        for (const key of keys) {
          const entry = Object.getOwnPropertyDescriptor(value, key)!
          if (!('value' in entry)) throw new TypeError('Accessors are not binary values')
          string(key, 11); visit(entry.value, depth + 1)
        }
      }
    } finally { ancestors.delete(value) }
  }
  visit(value, 0)
  const capacity = prefix.length + size
  if (!Number.isSafeInteger(capacity)) throw new RangeError('Binary output is too large')
  const output = new Uint8Array(capacity)
  output.set(prefix)
  output.set(MAGIC, prefix.length)
  let position = prefix.length + MAGIC.length
  let view: DataView | undefined
  const uint = (value: number) => {
    while (value >= 128) {
      output[position++] = value % 128 | 128
      value = Math.floor(value / 128)
    }
    output[position++] = value
  }
  for (let cursor = 0; cursor < plan.length;) {
    const tag = plan[cursor++]
    if (tag !== 11) output[position++] = tag
    if (tag < 4) continue
    if (tag === 4) {
      view ??= new DataView(output.buffer)
      view.setFloat64(position, plan[cursor++], false)
      position += 8
    } else if (tag === 5 || tag === 6) {
      let value = plan[cursor++] as bigint
      // Seven varint bytes fit exactly in a safe-integer Number (49 bits).
      // Extract one BigInt limb rather than shifting/masking BigInt for every byte.
      while (value >= BIGINT_LIMB) {
        let limb = Number(value & BIGINT_MASK)
        for (let index = 0; index < 7; index++) {
          output[position++] = limb % 128 | 128
          limb = Math.floor(limb / 128)
        }
        value >>= 49n
      }
      uint(Number(value))
    } else if (tag === 7 || tag === 11) {
      const value = plan[cursor++] as string
      const length = plan[cursor++] as number
      uint(length)
      if (length === value.length) {
        for (let index = 0; index < length; index++) output[position++] = value.charCodeAt(index)
      } else {
        const result = utf8.encodeInto(value, output.subarray(position, position + length))
        if (result.read !== value.length || result.written !== length) throw new Error('UTF-8 planning mismatch')
        position += length
      }
    } else if (tag === 8) {
      const value = plan[cursor++] as Uint8Array
      const length = plan[cursor++] as number
      if (value.length !== length) throw new RangeError('Byte input changed while encoding')
      uint(length); output.set(value, position); position += length
    } else {
      uint(plan[cursor++])
    }
  }
  if (position !== capacity) throw new Error('Binary planning mismatch')
  return output
}

/** Strict decoder: byte input, version, canonical ordering, bounds and complete consumption. */
export function decodeValue(input: Uint8Array, options: ValueLimits = {}): any {
  const limits = limitsFor(options)
  if (!(input instanceof Uint8Array)) throw new TypeError('Wire payload must be Uint8Array')
  if (input.length > limits.maxBytes) throw new RangeError('Binary value exceeds byte limit')
  const reader = new BinaryReader(input)
  if (reader.readBytes(MAGIC.length).some((byte, index) => byte !== MAGIC[index])) throw new TypeError('Unsupported binary wire version')
  let nodes = 0
  const string = () => text.decode(reader.readFrame())
  const read = (depth: number): any => {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) throw new RangeError('Binary value exceeds complexity limit')
    const tag = reader.readBytes(1)[0]
    if (tag === 0) return undefined
    if (tag === 1) return null
    if (tag === 2) return false
    if (tag === 3) return true
    if (tag === 4) {
      const bytes = reader.readBytes(8)
      const value = new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, false)
      if (!Number.isFinite(value)) throw new TypeError('Binary numbers must be finite')
      return value
    }
    if (tag === 5 || tag === 6) {
      const value = reader.readVarBigInt()
      if (tag === 6 && value === 0n) throw new TypeError('Non-canonical negative zero')
      return tag === 6 ? -value : value
    }
    if (tag === 7) return string()
    if (tag === 8) return new Uint8Array(reader.readFrame())
    if (tag === 9 || tag === 10) {
      const count = reader.readVarUint()
      if (count > limits.maxNodes - nodes || count > reader.remaining) throw new RangeError('Invalid binary collection size')
      if (tag === 9) return Array.from({ length: count }, () => read(depth + 1))
      const result = {}
      let previous: string | undefined
      for (let index = 0; index < count; index++) {
        const key = string()
        if (previous !== undefined && key <= previous) throw new TypeError('Non-canonical binary map keys')
        previous = key
        Object.defineProperty(result, key, { value: read(depth + 1), enumerable: true, writable: true, configurable: true })
      }
      return result
    }
    throw new TypeError('Unknown binary value tag')
  }
  const value = read(0)
  if (reader.remaining) throw new TypeError('Trailing binary data')
  return value
}

/** Domain separation prevents RPC bytes from being accepted as worker/chat/peer messages. */
export const encodeWire = (channel: string, value: unknown, limits?: ValueLimits) => encodeValue([channel, value], limits)
export function decodeWire(channel: string, bytes: Uint8Array, limits?: ValueLimits): any {
  const envelope = decodeValue(bytes, limits)
  if (!Array.isArray(envelope) || envelope.length !== 2 || envelope[0] !== channel) throw new TypeError('Wrong binary message channel')
  return envelope[1]
}

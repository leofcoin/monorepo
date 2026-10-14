/** Dependency-free, unsigned base-128 framing. No process-global byte counters. */
const MAX_BIGINT = (1n << 256n) - 1n

function size(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Expected an unsigned safe integer')
}

function bytes(value: Uint8Array): void {
  if (!(value instanceof Uint8Array)) throw new TypeError('Expected Uint8Array')
}

export function varUintLength(value: number): number {
  size(value)
  let length = 1
  while (value >= 128) {
    value = Math.floor(value / 128)
    length++
  }
  return length
}

export function varBigIntLength(value: bigint): number {
  if (typeof value !== 'bigint') throw new TypeError('Expected BigInt')
  if (value < 0n || value > MAX_BIGINT) throw new RangeError('Expected an unsigned 256-bit integer')
  let length = 1
  while (value >= 128n) {
    value >>= 7n
    length++
  }
  return length
}

/** Fixed-capacity writer. finish() is a view; copy it before reusing/resetting the writer. */
export class BinaryWriter {
  #buffer: Uint8Array
  #position = 0
  constructor(capacity: number | Uint8Array = 64) {
    if (typeof capacity === 'number') {
      size(capacity)
      this.#buffer = new Uint8Array(capacity)
    } else {
      bytes(capacity)
      this.#buffer = capacity
    }
  }
  get position(): number {
    return this.#position
  }
  get remaining(): number {
    return this.#buffer.length - this.#position
  }
  #require(length: number): void {
    size(length)
    if (length > this.remaining) throw new RangeError('Binary output buffer is too small')
  }
  writeVarUint(value: number): this {
    this.#require(varUintLength(value))
    this.#writeVarUint(value)
    return this
  }
  #writeVarUint(value: number): void {
    while (value >= 128) {
      this.#buffer[this.#position++] = value % 128 | 128
      value = Math.floor(value / 128)
    }
    this.#buffer[this.#position++] = value
  }
  writeVarBigInt(value: bigint): this {
    this.#require(varBigIntLength(value))
    do {
      const byte = Number(value & 127n)
      value >>= 7n
      this.#buffer[this.#position++] = byte | (value ? 128 : 0)
    } while (value)
    return this
  }
  writeBytes(value: Uint8Array): this {
    bytes(value)
    this.#require(value.length)
    this.#buffer.set(value, this.#position)
    this.#position += value.length
    return this
  }
  writeFrame(value: Uint8Array): this {
    bytes(value)
    // Check the complete operation before writing its length prefix.
    const prefixLength = varUintLength(value.length)
    this.#require(prefixLength + value.length)
    const prefixStart = this.#buffer.byteOffset + this.#position
    if (
      value.buffer === this.#buffer.buffer &&
      value.byteOffset < prefixStart + prefixLength &&
      value.byteOffset + value.length > prefixStart
    )
      throw new RangeError('Frame source overlaps its length prefix')
    this.#writeVarUint(value.length)
    this.#buffer.set(value, this.#position)
    this.#position += value.length
    return this
  }
  reset(): this {
    this.#position = 0
    return this
  }
  finish(copy = false): Uint8Array {
    const result = this.#buffer.subarray(0, this.#position)
    return copy ? result.slice() : result
  }
}

/** Reads views of the original buffer. Failed operations leave the cursor unchanged. */
export class BinaryReader {
  #buffer: Uint8Array
  #position = 0
  constructor(buffer: Uint8Array) {
    bytes(buffer)
    this.#buffer = buffer
  }
  get position(): number {
    return this.#position
  }
  get remaining(): number {
    return this.#buffer.length - this.#position
  }
  readVarUint(canonical = true): number {
    let result = 0
    let multiplier = 1
    for (let index = 0; index < 8; index++) {
      const cursor = this.#position + index
      if (cursor >= this.#buffer.length) throw new RangeError('Truncated varint')
      const byte = this.#buffer[cursor]
      const payload = byte & 127
      if (index === 7 && payload > Math.floor((Number.MAX_SAFE_INTEGER - result) / multiplier))
        throw new RangeError('Varint exceeds safe integer range')
      result += payload * multiplier
      if (byte < 128) {
        if (canonical && index > 0 && payload === 0) throw new RangeError('Non-canonical varint')
        this.#position = cursor + 1
        return result
      }
      multiplier *= 128
    }
    throw new RangeError('Varint exceeds safe integer range')
  }
  readVarBigInt(canonical = true): bigint {
    let result = 0n
    for (let index = 0; index < 37; index++) {
      const cursor = this.#position + index
      if (cursor >= this.#buffer.length) throw new RangeError('Truncated varint')
      const byte = this.#buffer[cursor]
      result |= BigInt(byte & 127) << BigInt(index * 7)
      if (result > MAX_BIGINT) throw new RangeError('Varint exceeds 256 bits')
      if (byte < 128) {
        if (canonical && index > 0 && byte === 0) throw new RangeError('Non-canonical varint')
        this.#position = cursor + 1
        return result
      }
    }
    throw new RangeError('Varint exceeds 256 bits')
  }
  readBytes(length: number): Uint8Array {
    size(length)
    if (length > this.remaining) throw new RangeError('Truncated binary field')
    const start = this.#position
    this.#position += length
    return this.#buffer.subarray(start, this.#position)
  }
  readFrame(canonical = true): Uint8Array {
    const start = this.#position
    try {
      return this.readBytes(this.readVarUint(canonical))
    } catch (error) {
      this.#position = start
      throw error
    }
  }
}

/** Existing smart-concat bytes, with exactly one output allocation and no prefix arrays. */
export function encodeFrames(frames: readonly Uint8Array[], prefix?: Uint8Array): Uint8Array {
  if (!Array.isArray(frames)) throw new TypeError('Expected an array of byte frames')
  if (prefix !== undefined) bytes(prefix)
  let length = prefix?.length ?? 0
  for (const frame of frames) {
    bytes(frame)
    length += varUintLength(frame.length) + frame.length
    size(length)
  }
  const writer = new BinaryWriter(length)
  if (prefix) writer.writeBytes(prefix)
  for (const frame of frames) writer.writeFrame(frame)
  return writer.finish()
}

export interface FrameOptions {
  canonical?: boolean
  maxFrames?: number
}

/** Iterative framing: bounded by the input length, not recursive stack depth. */
export function decodeFrames(buffer: Uint8Array, prefixLength = 0, options: FrameOptions = {}): Uint8Array[] {
  const reader = new BinaryReader(buffer)
  reader.readBytes(prefixLength)
  const maxFrames = options.maxFrames ?? buffer.length
  size(maxFrames)
  const frames: Uint8Array[] = []
  while (reader.remaining) {
    if (frames.length >= maxFrames) throw new RangeError('Too many binary frames')
    frames.push(reader.readFrame(options.canonical ?? true))
  }
  return frames
}

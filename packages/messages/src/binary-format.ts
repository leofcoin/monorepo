import { FormatInterface, Codec } from '@leofcoin/codec-format-interface'
import { encodeValue, encodeValueWithPrefix, decodeValue } from '@leofcoin/binary'

type Kind = 'any' | 'bytes' | 'array' | 'bigint' | 'string' | 'number' | 'boolean' | 'object' | 'function' | 'symbol'
type Field = { key: string; name: string; kind: Kind }
type Schema = { fields: readonly Field[]; prefixes: Map<string, Uint8Array> }
const schemas = new WeakMap<object, Schema>()

const kindOf = (value: any): Kind => value === undefined ? 'any'
  : value instanceof Uint8Array ? 'bytes' : Array.isArray(value) ? 'array' : typeof value as Kind

function schemaFor(proto: object): Schema {
  const cached = schemas.get(proto)
  if (cached) return cached
  const keys = Object.keys(proto)
  const schema: Schema = {
    fields: keys.map(key => ({
      key, name: key.endsWith('?') ? key.slice(0, -1) : key, kind: kindOf((proto as Record<string, any>)[key])
    })),
    prefixes: new Map()
  }
  // Only immutable declarations can safely reuse keys, types and codec framing.
  // Caller-defined mutable schemas remain supported and are recompiled per operation.
  if (Object.isFrozen(proto) && keys.every(key => 'value' in Object.getOwnPropertyDescriptor(proto, key)!))
    schemas.set(proto, schema)
  return schema
}

function codecPrefix(schema: Schema, name: string): Uint8Array {
  let prefix = schema.prefixes.get(name)
  if (!prefix) {
    const codec = new Codec(name)
    if (!codec.codecBuffer) throw new Error('invalid codec')
    prefix = new Uint8Array(codec.codecBuffer)
    schema.prefixes.set(name, prefix)
  }
  return prefix
}

/** Codec prefix + versioned binary tuple, in declared schema order. No proto-array JSON. */
export class BinaryFormat extends FormatInterface {
  protected field(key: string, value: any, kind?: Kind) {
    if (value === undefined) return value
    kind ??= kindOf((this.proto as Record<string, any>)[key])
    if (kind === 'any') return value
    if (kind === 'bigint') {
      if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new TypeError('Unsafe integer message field')
      if (!['number', 'string', 'bigint'].includes(typeof value)) throw new TypeError('Invalid BigInt message field')
      return BigInt(value)
    }
    if (kind === 'bytes') {
      if (!(value instanceof Uint8Array)) throw new TypeError('Message byte field must be Uint8Array')
    } else if (kind === 'array') {
      if (!Array.isArray(value)) throw new TypeError('Message array field must be an array')
    } else if (typeof value !== kind || value === null) throw new TypeError('Message field type mismatch')
    return value
  }
  create(value: any) {
    const { fields } = schemaFor(this.proto)
    // Content hashes are derived, never trusted from a caller-supplied cache field.
    this.decoded = Object.fromEntries(fields.map(field => {
      const input = value?.[field.name]
      return [field.name, field.kind === 'bigint' ? this.field(field.key, input, field.kind) : input]
    }))
  }
  protected tuple(value: any, fields: readonly Field[]) {
    const tuple = new Array(fields.length)
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index]
      tuple[index] = this.field(field.key, value[field.name], field.kind)
    }
    return tuple
  }
  protoEncode(value: any) {
    return encodeValue(this.tuple(value, schemaFor(this.proto).fields))
  }
  encode(value?: any): Uint8Array {
    value = value || this.decoded
    const schema = schemaFor(this.proto)
    const prefix = codecPrefix(schema, this.name)
    if (value instanceof Uint8Array) {
      // Preserve the base interface's already-encoded-content path.
      const output = new Uint8Array(prefix.length + value.length)
      output.set(prefix); output.set(value, prefix.length)
      this.encoded = output
    } else {
      this.encoded = encodeValueWithPrefix(this.tuple(value, schema.fields), prefix)
    }
    return this.encoded
  }
  protoDecode(bytes: Uint8Array) {
    const values = decodeValue(bytes)
    const { fields } = schemaFor(this.proto)
    if (!Array.isArray(values) || values.length !== fields.length) throw new TypeError('Binary message schema mismatch')
    return Object.fromEntries(fields.map((field, index) => {
      const value = this.field(field.key, values[index], field.kind)
      if (typeof value !== typeof values[index]) throw new TypeError('Non-canonical message field type')
      return [field.name, value]
    }))
  }
  decode(bytes?: Uint8Array) {
    bytes ??= this.encoded
    if (!(bytes instanceof Uint8Array)) throw new TypeError('Message payload must be Uint8Array')
    const codec = new Codec(bytes)
    if (codec.name !== this.name) throw new TypeError('Wrong binary message codec')
    // Parse the codec once and borrow its content view; decoded byte fields still own copies.
    this.decoded = this.protoDecode(bytes.subarray(codec.codecBuffer.length))
    return this.decoded
  }
  fromUint8Array(bytes: Uint8Array) { this.encoded = bytes; return this.decode(bytes) }
  fromArrayBuffer(buffer: ArrayBuffer) { return this.fromUint8Array(new Uint8Array(buffer)) }
}

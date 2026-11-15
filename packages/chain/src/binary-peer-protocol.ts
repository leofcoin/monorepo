import { BinaryFormat } from '@leofcoin/messages'

type BinaryProtocolNode = {
  protos: Record<string, new (value: object) => { proto: object }>
  binaryApplicationProtocol?: number
}

/** Install before discovery starts; peernet's stock proto-array schemas embed JSON values. */
export function installBinaryPeerProtocol(node: BinaryProtocolNode) {
  if (!node.protos) throw new Error('Peer message registry is unavailable')
  for (const [name, Original] of Object.entries(node.protos)) {
    const schema: Record<string, unknown> = { ...new Original({}).proto }
    // Responses intentionally contain a generic typed value, not JSON coerced into a byte field.
    if (name === 'peernet-response') schema.response = undefined
    Object.freeze(schema)
    const byteFields = Object.keys(schema).filter(key => schema[key] instanceof Uint8Array)
      .map(key => key.endsWith('?') ? key.slice(0, -1) : key)
    node.protos[name] = class extends BinaryFormat {
      constructor(value: object) {
        if (value && typeof value === 'object' && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)) {
          const fields: Record<string, unknown> = { ...value }
          for (const field of byteFields) {
            if (typeof fields[field] === 'string')
              fields[field] = new TextEncoder().encode(fields[field])
          }
          value = fields
        }
        super(value, schema, { name })
      }
    }
  }
  node.binaryApplicationProtocol = 1
}

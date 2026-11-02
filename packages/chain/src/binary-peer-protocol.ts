import { BinaryFormat } from '@leofcoin/messages'

/** Install before discovery starts; peernet's stock proto-array schemas embed JSON values. */
export function installBinaryPeerProtocol(node) {
  if (!node.protos) throw new Error('Peer message registry is unavailable')
  for (const [name, Original] of Object.entries(node.protos) as Array<[string, any]>) {
    const schema = { ...new Original({}).proto }
    // Responses intentionally contain a generic typed value, not JSON coerced into a byte field.
    if (name === 'peernet-response') schema.response = undefined
    Object.freeze(schema)
    const byteFields = Object.keys(schema).filter(key => schema[key] instanceof Uint8Array)
      .map(key => key.endsWith('?') ? key.slice(0, -1) : key)
    node.protos[name] = class extends BinaryFormat {
      constructor(value) {
        if (value && typeof value === 'object' && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)) {
          value = { ...value }
          for (const field of byteFields) {
            if (typeof value[field] === 'string')
              value[field] = new TextEncoder().encode(value[field])
          }
        }
        super(value, schema, { name })
      }
    }
  }
  node.binaryApplicationProtocol = 1
}

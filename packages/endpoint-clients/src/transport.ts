import { decodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'

/** Bound allocation while receiving, not only after arrayBuffer() has buffered an untrusted body. */
export async function readBinaryResponse(response: Response, maxBytes = 4 * 1024 * 1024): Promise<any> {
  if (response.headers.get('content-type')?.split(';')[0] !== BINARY_CONTENT_TYPE) throw new Error('Node does not support binary RPC')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Binary response has no body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new RangeError('Binary response exceeds byte limit') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return decodeWire('rpc', bytes, { maxBytes })
}

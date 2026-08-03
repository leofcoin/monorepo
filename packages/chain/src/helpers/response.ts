import { Codec } from '@leofcoin/codec-format-interface'

const MAX_RESPONSE_DEPTH = 3

/** Remove only verified peernet-response envelopes and decode JSON payloads. */
export const decodeResponsePayload = async (result: unknown, depth = 0): Promise<unknown> => {
  if (depth > MAX_RESPONSE_DEPTH) throw new Error('peernet response nesting exceeds limit')

  if (result instanceof Uint8Array) {
    let codec: Codec | undefined
    try {
      codec = new Codec(result)
    } catch {}

    if (codec?.name === 'peernet-response') {
      const ResponseMessage = (globalThis as any).peernet?.protos?.['peernet-response']
      if (!ResponseMessage) throw new Error('peernet-response codec is not registered')
      const wrapped = new ResponseMessage(result)
      return decodeResponsePayload(wrapped.decoded.response, depth + 1)
    }

    try {
      return JSON.parse(new TextDecoder().decode(result))
    } catch {
      return result
    }
  }

  if (result && typeof result === 'object') {
    const response = (result as any).decoded?.response ?? (result as any).response
    if (response !== undefined) return decodeResponsePayload(response, depth + 1)
  }

  if (typeof result === 'string') {
    try {
      return JSON.parse(result)
    } catch {
      return result
    }
  }

  return result
}

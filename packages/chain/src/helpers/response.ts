import { Codec } from '@leofcoin/codec-format-interface'

/** Accept bytes at the boundary, unwrap one canonical binary peer response. No JSON fallback. */
export const decodeResponsePayload = async (result: unknown): Promise<any> => {
  if (!(result instanceof Uint8Array)) throw new TypeError('Peer response must be Uint8Array')
  const codec = new Codec(result)
  if (codec.name !== 'peernet-response') return result
  const ResponseMessage = (globalThis as any).peernet?.protos?.['peernet-response']
  if (!ResponseMessage) throw new Error('peernet-response codec is not registered')
  return new ResponseMessage(result).decoded.response
}

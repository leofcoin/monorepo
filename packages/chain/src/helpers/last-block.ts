import { Codec } from '@leofcoin/codec-format-interface'
import { BlockMessage, LastBlockMessage } from '@leofcoin/messages'

const MAX_RESPONSE_DEPTH = 3

const asLastBlockMessage = async (blockInput: unknown, claimedHash?: string): Promise<LastBlockMessage> => {
  const block = new BlockMessage(blockInput as any)
  const hash = await block.hash()

  if (claimedHash && hash !== claimedHash) {
    throw new Error(`lastBlock hash mismatch: expected ${claimedHash}, got ${hash}`)
  }

  return new LastBlockMessage({ hash, index: block.decoded.index })
}

const resolveLegacyHash = async (hash: string): Promise<LastBlockMessage> => {
  const blockData = await (globalThis as any).peernet?.get?.(hash, 'block')
  if (!blockData) throw new Error(`unable to resolve lastBlock hash: ${hash}`)
  return asLastBlockMessage(blockData, hash)
}

/** Resolve current and legacy lastBlock responses to the canonical { hash, index } message. */
export const resolveLastBlockMessage = async (result: unknown, depth = 0): Promise<LastBlockMessage> => {
  if (depth > MAX_RESPONSE_DEPTH) throw new Error('lastBlock response nesting exceeds limit')

  if (result instanceof Uint8Array) {
    let codec: Codec | undefined
    try {
      codec = new Codec(result)
    } catch {}

    if (codec) {
      if (codec.name === 'peernet-response') {
        const ResponseMessage = (globalThis as any).peernet?.protos?.['peernet-response']
        if (!ResponseMessage) throw new Error('peernet-response codec is not registered')

        const wrapped = new ResponseMessage(result)
        if (wrapped?.decoded?.response === undefined) throw new Error('peernet-response has no response payload')
        return resolveLastBlockMessage(wrapped.decoded.response, depth + 1)
      }

      if (codec.name === 'last-block-message') return new LastBlockMessage(result)
      if (codec.name === 'block-message') return asLastBlockMessage(result)
    }

    const candidate = new TextDecoder().decode(result)
    if (candidate) return resolveLegacyHash(candidate)
  }

  if (typeof result === 'string') return resolveLegacyHash(result)

  if (result && typeof result === 'object') {
    const response = (result as any).decoded?.response ?? (result as any).response
    if (response !== undefined) return resolveLastBlockMessage(response, depth + 1)
    if ('hash' in result && 'index' in result) return new LastBlockMessage(result as any)
    if ('previousHash' in result && 'index' in result) return asLastBlockMessage(result)
  }

  throw new Error(`invalid lastBlock payload: ${typeof result}`)
}

import { Codec } from '@leofcoin/codec-format-interface'
import { LastBlockMessage } from '@leofcoin/messages'

/** The only advertised tip representation is a binary last-block message. */
export const resolveLastBlockMessage = async (result: unknown): Promise<LastBlockMessage> => {
  if (!(result instanceof Uint8Array) || new Codec(result).name !== 'last-block-message')
    throw new TypeError('lastBlock response must be a binary last-block message')
  return new LastBlockMessage(result)
}

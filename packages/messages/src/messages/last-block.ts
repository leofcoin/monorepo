import proto from '../protos/last-block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class LastBlockMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'LastBlockMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof LastBlockMessage) return buffer
    const name = 'last-block-message'
    super(buffer, proto, { name })
  }
}

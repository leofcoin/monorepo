import proto from '../protos/last-block-request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class LastBlockRequestMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'LastBlockRequestMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof LastBlockRequestMessage) return buffer
    const name = 'last-block-request-message'
    super(buffer, proto, { name })
  }
}

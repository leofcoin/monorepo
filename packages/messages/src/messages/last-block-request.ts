import proto from '../protos/last-block-request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class LastBlockRequestMessage extends FormatInterface {
  declare decoded: typeof proto
  
  get messageName() {
    return 'LastBlockRequestMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'last-block-request-message'
    super(buffer, proto, {name})
  }
}

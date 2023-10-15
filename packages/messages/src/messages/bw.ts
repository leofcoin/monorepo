import proto from '../protos/bw.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class BWMessage extends FormatInterface {
  declare decoded: typeof proto
  get messageName() {
    return 'BWMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'bw-message'
    super(buffer, proto, {name})
  }
}

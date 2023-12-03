import proto from '../protos/bw.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class BWMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto
  get messageName() {
    return 'BWMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BWMessage) return buffer
    const name = 'bw-message'
    super(buffer, proto, { name })
  }
}

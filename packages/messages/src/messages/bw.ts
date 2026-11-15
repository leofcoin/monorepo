import proto from '../protos/bw.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface BWMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class BWMessage extends FormatInterface {
  get messageName() {
    return 'BWMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BWMessage) return buffer
    const name = 'bw-message'
    super(buffer, proto, { name })
  }
}

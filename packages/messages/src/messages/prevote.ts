import proto from '../protos/prevote.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface PrevoteMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class PrevoteMessage extends FormatInterface {
  get messageName() {
    return 'PrevoteMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof PrevoteMessage) return buffer
    const name = 'prevote-message'
    super(buffer, proto, { name })
  }
}

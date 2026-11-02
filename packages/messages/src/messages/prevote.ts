import proto from '../protos/prevote.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default class PrevoteMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'PrevoteMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof PrevoteMessage) return buffer
    const name = 'prevote-message'
    super(buffer, proto, { name })
  }
}

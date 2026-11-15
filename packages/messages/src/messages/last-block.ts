import proto from '../protos/last-block.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface LastBlockMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class LastBlockMessage extends FormatInterface {
  get messageName() {
    return 'LastBlockMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof LastBlockMessage) return buffer
    const name = 'last-block-message'
    super(buffer, proto, { name })
  }
}

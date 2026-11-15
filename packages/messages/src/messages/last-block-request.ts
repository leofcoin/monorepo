import proto from '../protos/last-block-request.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface LastBlockRequestMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class LastBlockRequestMessage extends FormatInterface {
  get messageName() {
    return 'LastBlockRequestMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof LastBlockRequestMessage) return buffer
    const name = 'last-block-request-message'
    super(buffer, proto, { name })
  }
}

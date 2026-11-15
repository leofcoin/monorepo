import proto from '../protos/state.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface StateMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class StateMessage extends FormatInterface {
  get messageName() {
    return 'StateMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof StateMessage) return buffer
    const name = 'state-message'
    super(buffer, proto, { name })
  }
}

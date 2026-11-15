import proto from '../protos/precommit.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface PrecommitMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class PrecommitMessage extends FormatInterface {
  get messageName() {
    return 'PrecommitMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof PrecommitMessage) return buffer
    const name = 'precommit-message'
    super(buffer, proto, { name })
  }
}

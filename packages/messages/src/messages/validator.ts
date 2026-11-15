import proto from '../protos/validator.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface ValidatorMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class ValidatorMessage extends FormatInterface {
  get messageName() {
    return 'ValidatorMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof ValidatorMessage) return buffer
    const name = 'validator-message'
    super(buffer, proto, { name })
  }
}

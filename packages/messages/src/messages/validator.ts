import proto from '../protos/validator.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class ValidatorMessage extends FormatInterface {
  declare decoded: typeof proto

  get messageName() {
    return 'ValidatorMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'validator-message'
    super(buffer, proto, {name})
  }
}

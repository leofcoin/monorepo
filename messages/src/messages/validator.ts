import proto from '../protos/validator.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ValidatorMessage extends FormatInterface {
  get messageName() {
    return 'ValidatorMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'validator-message'
    super(buffer, proto, {name})
  }
}

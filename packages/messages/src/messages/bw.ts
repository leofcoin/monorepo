import proto from '../protos/bw.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class BWMessage extends FormatInterface {
  get messageName() {
    return 'BWMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'bw-message'
    super(buffer, proto, {name})
  }
}

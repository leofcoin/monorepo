import proto from '../protos/bw-request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class BWRequestMessage extends FormatInterface {
  get messageName() {
    return 'BWRequestMessage'
  }

  constructor(buffer?: messageInput) {
    const name = 'bw-request-message'
    super(buffer, proto, {name})
  }
}

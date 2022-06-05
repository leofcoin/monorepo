import proto from './../protos/bw-request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class BWRequestMessage extends FormatInterface {
  get keys() {
    return []
  }

  get messageName() {
    return 'BWRequestMessage'
  }

  constructor(buffer) {
    const name = 'bw-request-message'
    super(buffer, proto, {name})
  }
}

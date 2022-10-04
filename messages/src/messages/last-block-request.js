import proto from './../protos/last-block-request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class LastBlockRequestMessage extends FormatInterface {
  get keys() {
    return []
  }

  get messageName() {
    return 'LastBlockRequestMessage'
  }

  constructor(buffer) {
    const name = 'last-block-request-message'
    super(buffer, proto, {name})
  }
}

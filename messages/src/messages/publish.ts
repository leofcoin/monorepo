import proto from '../protos/publish.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class BWRequestMessage extends FormatInterface {
  get messageName() {
    return 'PublishMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'publish-message'
    super(buffer, proto, {name})
  }
}

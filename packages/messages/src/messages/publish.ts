import proto from '../protos/publish.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class BWRequestMessage extends FormatInterface {
  declare decoded: typeof proto

  get messageName() {
    return 'PublishMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'publish-message'
    super(buffer, proto, {name})
  }
}

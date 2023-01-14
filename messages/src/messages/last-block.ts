import proto from '../protos/last-block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class LastBlockMessage extends FormatInterface {
  get messageName() {
    return 'LastBlockMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'last-block-message'
    super(buffer, proto, {name})
  }
}

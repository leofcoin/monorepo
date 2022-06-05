import proto from './../protos/block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class LastBlockMessage extends FormatInterface {
  get keys() {
    return ['hash', 'index']
  }

  get messageName() {
    return 'LastBlockMessage'
  }

  constructor(buffer) {
    const name = 'last-block-message'
    super(buffer, proto, {name})
  }
}

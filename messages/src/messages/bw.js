import proto from './../protos/bw.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class BWMessage extends FormatInterface {
  get keys() {
    return ['up', 'down']
  }

  get messageName() {
    return 'BWMessage'
  }

  constructor(buffer) {
    const name = 'bw-message'
    super(buffer, proto, {name})
  }
}

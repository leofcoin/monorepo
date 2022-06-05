import proto from './../protos/block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class BlockMessage extends FormatInterface {
  get keys() {
    return ['index', 'previousHash', 'timestamp', 'reward', 'fees', 'transactions', 'validators']
  }

  get messageName() {
    return 'BlockMessage'
  }

  constructor(buffer) {
    const name = 'block-message'
    super(buffer, proto, {name})
  }
}

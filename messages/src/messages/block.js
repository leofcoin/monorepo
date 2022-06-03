import protons from 'protons'
import proto from './../protos/block.proto.js'
import { FormatInterface as CodecFormat } from '@leofcoin/codec-format-interface'

export default class BlockMessage extends CodecFormat {
  get keys() {
    return ['index', 'previousHash', 'timestamp', 'reward', 'fees', 'transactions', 'validators']
  }

  constructor(buffer) {
    const name = 'block-message'
    super(buffer, protons(proto).BlockMessage, {name})
  }
}

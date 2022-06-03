import protons from 'protons'
import proto from './../protos/last-block.proto.js'
import { FormatInterface as CodecFormat } from '@leofcoin/codec-format-interface'

export default class LastBlockMessage extends CodecFormat {
  get keys() {
    return ['hash', 'index']
  }

  constructor(buffer) {
    const name = 'last-block-message'
    super(buffer, protons(proto).LastBlockMessage, {name})
  }
}

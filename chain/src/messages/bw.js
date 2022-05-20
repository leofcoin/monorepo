import protons from 'protons'
import proto from './../protos/bw.proto.js'
import { FormatInterface as CodecFormat } from '@leofcoin/codec-format-interface'

export default class BWMessage extends CodecFormat {
  get keys() {
    return ['up', 'down']
  }

  constructor(buffer) {
    const name = 'bw-message'
    super(buffer, protons(proto).BWMessage, {name})
  }
}

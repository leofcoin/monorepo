import protons from 'protons'
import proto from './../protos/last-block.proto.js'
import CodecFormat from './../../node_modules/@leofcoin/peernet/src/codec/codec-format-interface'

export default class LastBlockMessage extends CodecFormat {
  get keys() {
    return ['hash', 'index']
  }

  constructor(buffer) {
    const name = 'last-block-message'
    super(buffer, protons(proto).LastBlockMessage, {name})
  }
}

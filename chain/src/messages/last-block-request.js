import protons from 'protons'
import proto from './../protos/last-block-request.proto.js'
import CodecFormat from './../../node_modules/@leofcoin/peernet/src/codec/codec-format-interface'

export default class LastBlockRequestMessage extends CodecFormat {
  get keys() {
    return []
  }

  constructor(buffer) {
    const name = 'last-block-request-message'
    super(buffer, protons(proto).LastBlockRequestMessage, {name})
  }
}

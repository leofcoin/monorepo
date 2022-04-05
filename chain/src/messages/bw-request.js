import protons from 'protons'
import proto from './../protos/bw-request.proto.js'
import CodecFormat from './../../node_modules/@leofcoin/peernet/src/codec/codec-format-interface'

export default class BWRequestMessage extends CodecFormat {
  get keys() {
    return []
  }

  constructor(buffer) {
    const name = 'bw-request-message'
    super(buffer, protons(proto).BWRequestMessage, {name})
  }
}

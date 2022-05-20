import protons from 'protons'
import proto from './../protos/last-block-request.proto.js'
import { FormatInterface as CodecFormat } from '@leofcoin/codec-format-interface'

export default class LastBlockRequestMessage extends CodecFormat {
  get keys() {
    return []
  }

  constructor(buffer) {
    const name = 'last-block-request-message'
    super(buffer, protons(proto).LastBlockRequestMessage, {name})
  }
}

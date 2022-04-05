import protons from 'protons'
import proto from './../protos/transaction.proto.js'
import CodecFormat from './../../node_modules/@leofcoin/peernet/src/codec/codec-format-interface'

export default class TransactionMessage extends CodecFormat {
  get keys() {
    return ['timestamp', 'from', 'to', 'method', 'params']
  }

  constructor(buffer) {
    const name = 'transaction-message'
    super(buffer, protons(proto).TransactionMessage, {name})
  }
}

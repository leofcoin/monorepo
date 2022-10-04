import protons from 'protons'
import proto from './../protos/transaction.proto.js'
import { FormatInterface as CodecFormat } from '@leofcoin/codec-format-interface'

export default class TransactionMessage extends CodecFormat {
  get keys() {
    return ['timestamp', 'from', 'to', 'nonce', 'method', 'params']
  }

  constructor(buffer) {
    const name = 'transaction-message'
    super(buffer, protons(proto).TransactionMessage, {name})
  }
}

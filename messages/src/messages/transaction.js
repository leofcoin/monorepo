import proto from './../protos/transaction.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class TransactionMessage extends FormatInterface {
  get keys() {
    return ['timestamp', 'from', 'to', 'nonce', 'method', 'params', 'signature']
  }

  get messageName() {
    return 'TransactionMessage'
  }

  constructor(buffer) {
    const name = 'transaction-message'
    super(buffer, proto, {name})
  }
}

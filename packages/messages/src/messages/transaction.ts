import proto from '../protos/transaction.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class TransactionMessage extends FormatInterface {
  get messageName() {
    return 'TransactionMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'transaction-message'
    super(buffer, proto, {name})
  }
}

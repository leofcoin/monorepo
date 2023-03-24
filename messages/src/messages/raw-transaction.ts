import proto from '../protos/raw-transaction.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class RawTransactionMessage extends FormatInterface {
  get messageName() {
    return 'RawTransactionMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'raw-transaction-message'
    super(buffer, proto, {name})
  }
}

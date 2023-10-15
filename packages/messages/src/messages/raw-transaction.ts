import proto from '../protos/raw-transaction.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class RawTransactionMessage extends FormatInterface {
  declare decoded: typeof proto

  get messageName() {
    return 'RawTransactionMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'raw-transaction-message'
    super(buffer, proto, {name})
  }
}

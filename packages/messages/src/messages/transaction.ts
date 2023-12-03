import proto from './../protos/transaction.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class TransactionMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'TransactionMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof TransactionMessage) return buffer
    const name = 'transaction-message'
    super(buffer, proto, { name })
  }
}

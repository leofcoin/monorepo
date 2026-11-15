import proto from './../protos/transaction.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

type DecodedTransaction = {
  timestamp: number
  from: string
  to: string
  method: string
  params: unknown[]
  signature: string
  nonce?: number
  dependsOn?: string[]
  priority?: boolean
}

export default interface TransactionMessage {
  get decoded(): DecodedTransaction
  set decoded(value: DecodedTransaction)
}

export default class TransactionMessage extends FormatInterface {
  get messageName() {
    return 'TransactionMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof TransactionMessage) return buffer
    const name = 'transaction-message'
    super(buffer, proto, { name })
  }

  beforeHashing(decoded: { [index: string]: any }) {
    decoded = super.beforeHashing(decoded)
    delete decoded.signature
    delete decoded.priority
    delete decoded.dependsOn
    return decoded
  }
}

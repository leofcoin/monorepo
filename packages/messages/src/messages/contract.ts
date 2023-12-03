import proto from '../protos/contract.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class ContractMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'ContractMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof ContractMessage) return buffer
    super(buffer, proto, { name: 'contract-message' })
  }
}

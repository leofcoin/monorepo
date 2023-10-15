import proto from '../protos/contract.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class ContractMessage extends FormatInterface {
  declare decoded: typeof proto

  get messageName() {
    return 'ContractMessage'
  }

  constructor(buffer: messageInput) {
    super(buffer, proto, {name: 'contract-message'})
  }
}

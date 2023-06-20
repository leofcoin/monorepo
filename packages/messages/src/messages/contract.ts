import proto from '../protos/contract.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ContractMessage extends FormatInterface {
  get messageName() {
    return 'ContractMessage'
  }

  constructor(buffer: messageInput) {
    super(buffer, proto, {name: 'contract-message'})
  }
}

import proto from './../protos/block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'

export default class ContractMessage extends FormatInterface {
  get keys() {
    return ['creator', 'contract', 'constructorParameters']
  }

  get messageName() {
    return 'ContractMessage'
  }

  constructor(buffer) {
    super(buffer, proto, {name: 'contract-message'})
  }
}

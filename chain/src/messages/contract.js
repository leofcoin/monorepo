import protons from 'protons'
import proto from './../protos/contract.proto.js'
import CodecFormat from './../../node_modules/@leofcoin/peernet/src/codec/codec-format-interface'

export default class ContractMessage extends CodecFormat {
  get keys() {
    return ['creator', 'constructorParameters', 'contract']
  }

  constructor(buffer) {
    const name = 'contract-message'
    super(buffer, protons(proto).ContractMessage, {name})
  }
}

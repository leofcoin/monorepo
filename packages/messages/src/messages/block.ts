import proto from '../protos/block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import TransactionMessage from './transaction.js'
import ValidatorMessage from './validator.js'
import smartConcat from '@vandeurenglenn/typed-array-smart-concat'
import smartDeconcat from '@vandeurenglenn/typed-array-smart-deconcat'
import { BigNumber } from '@leofcoin/utils'
import { messageInput } from '../types.js'

export default class BlockMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: {
    index: Number
    previousHash: String
    timestamp: String
    reward: BigNumber
    fees: BigNumber
    transactions: TransactionMessage['decoded'][]
    validators: ValidatorMessage['decoded'][]
  }

  get messageName() {
    return 'BlockMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BlockMessage) return buffer
    const name = 'block-message'
    super(buffer, proto, { name })
  }

  encode(decoded?): Uint8Array {
    decoded = decoded || this.decoded
    const validators: Uint8Array[] = []

    for (const validator of decoded.validators) {
      if (validator instanceof ValidatorMessage) validators.push(validator.encode())
      else validators.push(new ValidatorMessage(validator).encode())
    }

    return super.encode({
      ...decoded,
      validators: smartConcat(validators)
    })
  }

  decode(encoded?) {
    encoded = encoded || this.encoded
    super.decode(encoded)
    // @ts-ignore
    this.decoded.validators = smartDeconcat(this.decoded.validators as Uint8Array).map(
      (validator) => new ValidatorMessage(validator).decoded
    )
    return this.decoded
  }
}

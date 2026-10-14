import proto from '../protos/block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import TransactionMessage from './transaction.js'
import ValidatorMessage from './validator.js'
import { encodeFrames, decodeFrames } from '@leofcoin/codecs/binary'
import { messageInput } from '../types.js'

export default class BlockMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: {
    index: Number
    previousHash: String
    timestamp: String
    reward: bigint
    fees: bigint
    transactions: TransactionMessage['decoded'][]
    validators: ValidatorMessage['decoded'][]
    producer: String
    producerProof: String
    protocolVersion: String
  }

  get messageName() {
    return 'BlockMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BlockMessage) return buffer
    const name = 'block-message'
    super(buffer, proto, { name })
  }

  encode(decoded?: BlockMessage['decoded']): Uint8Array {
    decoded = decoded || this.decoded
    const validators: Uint8Array[] = []

    for (const validator of decoded.validators) {
      if (validator instanceof ValidatorMessage) validators.push(validator.encode())
      else validators.push(new ValidatorMessage(validator).encode())
    }

    return super.encode({
      ...decoded,
      validators: encodeFrames(validators)
    })
  }

  decode(encoded?: Uint8Array) {
    encoded = encoded || this.encoded
    super.decode(encoded)
    // @ts-ignore
    // Preserve historical acceptance of padded length prefixes. Tightening
    // canonical protocol validation is a separate, versioned decision.
    this.decoded.validators = decodeFrames(this.decoded.validators as Uint8Array, 0, { canonical: false }).map(
      (validator) => new ValidatorMessage(validator).decoded
    )
    return this.decoded
  }
}

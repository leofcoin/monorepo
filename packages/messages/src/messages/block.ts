import proto from '../protos/block.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import TransactionMessage from './transaction.js'
import ValidatorMessage from './validator.js'
import smartConcat from '@vandeurenglenn/typed-array-smart-concat'
import smartDeconcat from '@vandeurenglenn/typed-array-smart-deconcat'
import type { messageInput } from '../types.js'

export default class BlockMessage extends FormatInterface {
  declare decoded: typeof proto

  get messageName() {
    return 'BlockMessage'
  }

  constructor(buffer: messageInput) {
    const name = 'block-message'
    super(buffer, proto, {name})
  }

  encode(): Uint8Array {
    const decoded = this.decoded
    const validators: Uint8Array[] = []
    const transactions: Uint8Array[] = []
    
    for (const validator of decoded.validators as any) {
      if (validator instanceof ValidatorMessage) validators.push(validator.encoded)
      else validators.push(new ValidatorMessage(validator).encoded)
    }

    for (const transaction of decoded.transactions as any) {
      if (transaction instanceof TransactionMessage) transactions.push(transaction.encoded)
      else transactions.push(new TransactionMessage(transaction).encoded)
    }

    return super.encode({
      ...decoded,
      validators: smartConcat(validators),
      transactions: smartConcat(transactions)
    })
  }

  decode() {
    super.decode()
    // @ts-ignore
    this.decoded.transactions = smartDeconcat(this.decoded.transactions as Uint8Array).map(transaction => new TransactionMessage(transaction).decoded) as TransactionMessage['decoded'][]
    // @ts-ignore
    this.decoded.validators = smartDeconcat(this.decoded.validators as Uint8Array).map(validator => new ValidatorMessage(validator).decoded) as ValidatorMessage['decoded'][]
    return this.decoded
  }
}

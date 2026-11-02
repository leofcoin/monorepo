import proto from '../protos/contract.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default class ContractMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'ContractMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof ContractMessage) return buffer
    if (buffer && typeof buffer === 'object' && !(buffer instanceof Uint8Array) && typeof (buffer as any).contract === 'string')
      buffer = { ...buffer, contract: new TextEncoder().encode((buffer as any).contract) }
    super(buffer, proto, { name: 'contract-message' })
  }
}

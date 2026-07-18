import proto from '../protos/proposal.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class ProposalMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'ProposalMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof ProposalMessage) return buffer
    const name = 'proposal-message'
    super(buffer, proto, { name })
  }
}

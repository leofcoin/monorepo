import proto from '../protos/proposal.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default interface ProposalMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class ProposalMessage extends FormatInterface {
  get messageName() {
    return 'ProposalMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof ProposalMessage) return buffer
    const name = 'proposal-message'
    super(buffer, proto, { name })
  }
}

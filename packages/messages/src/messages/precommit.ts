import proto from '../protos/precommit.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class PrecommitMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'PrecommitMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof PrecommitMessage) return buffer
    const name = 'precommit-message'
    super(buffer, proto, { name })
  }
}

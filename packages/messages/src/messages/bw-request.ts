import proto from './../protos/bw-request.proto.js'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import type { messageInput } from '../types.js'

export default class BWRequestMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'BWRequestMessage'
  }

  constructor(buffer?: messageInput) {
    if (buffer instanceof BWRequestMessage) return buffer
    const name = 'bw-request-message'
    super(buffer, proto, { name })
  }
}

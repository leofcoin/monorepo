import proto from './../protos/bw-request.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
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

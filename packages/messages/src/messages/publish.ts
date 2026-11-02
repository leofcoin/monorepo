import proto from '../protos/publish.proto.js'
import { BinaryFormat as FormatInterface } from '../binary-format.js'
import type { messageInput } from '../types.js'

export default class publishMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'PublishMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof publishMessage) return buffer
    const name = 'publish-message'
    super(buffer, proto, { name })
  }
}

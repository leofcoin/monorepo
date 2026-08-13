import { FormatInterface } from '@leofcoin/codec-format-interface'
import proto from '../protos/beacon-share.proto.js'
import type { messageInput } from '../types.js'

export default class BeaconShareMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'BeaconShareMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BeaconShareMessage) return buffer
    super(buffer, proto, { name: 'beacon-share-message' })
  }
}

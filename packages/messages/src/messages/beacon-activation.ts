import { FormatInterface } from '@leofcoin/codec-format-interface'
import proto from '../protos/beacon-activation.proto.js'
import type { messageInput } from '../types.js'

export default class BeaconActivationMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'BeaconActivationMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BeaconActivationMessage) return buffer
    super(buffer, proto, { name: 'beacon-activation-message' })
  }
}

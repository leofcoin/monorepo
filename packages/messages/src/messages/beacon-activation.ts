import { BinaryFormat as FormatInterface } from '../binary-format.js'
import proto from '../protos/beacon-activation.proto.js'
import type { messageInput } from '../types.js'

export default interface BeaconActivationMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class BeaconActivationMessage extends FormatInterface {
  get messageName() {
    return 'BeaconActivationMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BeaconActivationMessage) return buffer
    super(buffer, proto, { name: 'beacon-activation-message' })
  }
}

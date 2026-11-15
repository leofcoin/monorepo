import { BinaryFormat as FormatInterface } from '../binary-format.js'
import proto from '../protos/beacon-commitment.proto.js'
import type { messageInput } from '../types.js'

export default interface BeaconCommitmentMessage {
  get decoded(): typeof proto
  set decoded(value: typeof proto)
}

export default class BeaconCommitmentMessage extends FormatInterface {
  get messageName() {
    return 'BeaconCommitmentMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BeaconCommitmentMessage) return buffer
    super(buffer, proto, { name: 'beacon-commitment-message' })
  }
}

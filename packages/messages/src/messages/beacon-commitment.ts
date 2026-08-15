import { FormatInterface } from '@leofcoin/codec-format-interface'
import proto from '../protos/beacon-commitment.proto.js'
import type { messageInput } from '../types.js'

export default class BeaconCommitmentMessage extends FormatInterface {
  // @ts-ignore
  declare decoded: typeof proto

  get messageName() {
    return 'BeaconCommitmentMessage'
  }

  constructor(buffer: messageInput) {
    if (buffer instanceof BeaconCommitmentMessage) return buffer
    super(buffer, proto, { name: 'beacon-commitment-message' })
  }
}

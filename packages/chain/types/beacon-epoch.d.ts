export type BeaconEpochDealer = { commitments: string[]; validator: string }
export type BeaconEpochConfig = {
  dealers: BeaconEpochDealer[]
  epoch: bigint
  threshold: number
  validators: string[]
}
export type BeaconActivationVote = {
  configDigest: string
  epoch: bigint
  from: string
  signature: string
}
export function beaconParticipants(validators: string[]): Map<string, bigint>
export function validateBeaconEpochConfig(config: BeaconEpochConfig): boolean
export function canonicalBeaconEpochConfig(config: BeaconEpochConfig): BeaconEpochConfig
export function encodeBeaconEpochConfig(config: BeaconEpochConfig): Uint8Array
export function beaconEpochDigest(config: BeaconEpochConfig): string
export function beaconEpochGroupPublicKey(config: BeaconEpochConfig): string
export class BeaconEpochVotes {
  constructor(config: BeaconEpochConfig)
  readonly config: BeaconEpochConfig
  readonly configDigest: string
  add(vote: BeaconActivationVote): 'accepted' | 'duplicate' | 'equivocation' | 'invalid'
  readonly ready: boolean
  certificate(): BeaconActivationVote[]
  equivocation(validator: string): BeaconActivationVote[] | undefined
}

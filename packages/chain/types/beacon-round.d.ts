import type { BeaconEpochConfig } from './beacon-epoch.d.ts'
export type AcceptedBeaconShare = { from: string; participant: bigint; signature: string }
export type FinalizedBeaconRound = {
  epoch: bigint
  proof: string
  randomness: string
  round: bigint
  signers: string[]
}
export class BeaconRound {
  constructor(network: string, config: BeaconEpochConfig, round: bigint, previousProof: Uint8Array)
  readonly epoch: bigint
  readonly round: bigint
  add(share: AcceptedBeaconShare): 'accepted' | 'duplicate' | 'equivocation' | 'invalid'
  readonly ready: boolean
  finalize(): FinalizedBeaconRound
  equivocation(validator: string): AcceptedBeaconShare[] | undefined
}

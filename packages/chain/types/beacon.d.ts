export type BeaconDealerContribution = {
  commitments: Uint8Array[]
  shares: Map<bigint, bigint>
}
export type BeaconSignatureShare = { participant: bigint; signature: Uint8Array }
export function createBeaconContribution(
  participants: bigint[],
  threshold: number,
  randomScalar: () => bigint
): BeaconDealerContribution
export function verifyBeaconShare(participant: bigint, share: bigint, commitments: Uint8Array[]): boolean
export function combineBeaconShares(shares: bigint[]): bigint
export function deriveBeaconPublicShare(participant: bigint, commitments: Uint8Array[][]): Uint8Array
export function deriveBeaconGroupPublicKey(commitments: Uint8Array[][]): Uint8Array
export function beaconMessage(network: string, epoch: bigint, round: bigint, previousProof: Uint8Array): Uint8Array
export function signBeaconRound(secretShare: bigint, message: Uint8Array): Uint8Array
export function verifyBeaconSignatureShare(
  signature: Uint8Array,
  message: Uint8Array,
  publicShare: Uint8Array
): boolean
export function reconstructBeaconSignature(shares: BeaconSignatureShare[], threshold: number): Uint8Array
export function verifyBeaconProof(proof: Uint8Array, message: Uint8Array, groupPublicKey: Uint8Array): boolean
export function beaconRandomness(proof: Uint8Array): Uint8Array

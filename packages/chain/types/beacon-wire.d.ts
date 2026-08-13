export type BeaconCommitmentData = {
  commitments: unknown
  epoch: unknown
  from: unknown
  participant: unknown
  signature?: unknown
  threshold: unknown
}
export type BeaconShareData = {
  epoch: unknown
  from: unknown
  participant: unknown
  round: unknown
  signature?: unknown
  signatureShare: unknown
}
export type BeaconActivationData = {
  configDigest: unknown
  epoch: unknown
  from: unknown
  signature?: unknown
}
export function validateBeaconActivationData(message: BeaconActivationData): boolean
export function validateBeaconCommitmentData(message: BeaconCommitmentData): boolean
export function validateBeaconShareData(message: BeaconShareData): boolean
export function signBeaconCommitmentMessage(validators: string, message: BeaconCommitmentData, identity: object): Promise<string>
export function signBeaconShareMessage(validators: string, message: BeaconShareData, identity: object): Promise<string>
export function verifyBeaconCommitmentMessage(validators: string, message: BeaconCommitmentData, network: string): Promise<boolean>
export function verifyBeaconShareMessage(validators: string, message: BeaconShareData, network: string): Promise<boolean>
export function signBeaconActivationMessage(validators: string, message: BeaconActivationData, identity: object): Promise<string>
export function verifyBeaconActivationMessage(validators: string, message: BeaconActivationData, network: string): Promise<boolean>

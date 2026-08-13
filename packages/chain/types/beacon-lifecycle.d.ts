import type { BeaconActivationVote, BeaconEpochConfig } from './beacon-epoch.d.ts'
export type ActiveBeaconEpoch = { certificate: BeaconActivationVote[]; config: BeaconEpochConfig }
export type PrivateBeaconEpoch = { encryptionPrivateKey: string; epoch: bigint; secretShare: string }
export function persistPublicBeaconEpoch(store: object, network: string, active: ActiveBeaconEpoch): Promise<void>
export function loadPublicBeaconEpoch(store: object, network: string, epoch: bigint): Promise<ActiveBeaconEpoch | undefined>
export function persistPrivateBeaconEpoch(
  store: object,
  network: string,
  validator: string,
  record: PrivateBeaconEpoch,
  sign: (bytes: Uint8Array) => Promise<Uint8Array>,
  randomNonce?: () => Uint8Array
): Promise<void>
export function loadPrivateBeaconEpoch(
  store: object,
  network: string,
  validator: string,
  epoch: bigint,
  sign: (bytes: Uint8Array) => Promise<Uint8Array>
): Promise<PrivateBeaconEpoch | undefined>
export function clearBeaconEpochStorage(stores: object[], network: string): Promise<void>
export function restoreBeaconLifecycle(
  publicStore: object,
  privateStore: object,
  network: string,
  validator: string,
  height: number,
  epochLength: number,
  sign: (bytes: Uint8Array) => Promise<Uint8Array>
): Promise<{ lifecycle: BeaconLifecycle; privateEpoch?: PrivateBeaconEpoch }>
export class BeaconLifecycle {
  constructor(epochLength: number)
  readonly epochLength: number
  epochAtHeight(height: number): bigint
  ceremonyEpoch(height: number): bigint
  stage(active: ActiveBeaconEpoch): void
  restore(active: ActiveBeaconEpoch): void
  advance(height: number): ActiveBeaconEpoch | undefined
  readonly active: ActiveBeaconEpoch | undefined
}

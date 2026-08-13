export type BeaconShareEnvelope = {
  ciphertext: Uint8Array
  ephemeralPublicKey: Uint8Array
  nonce: Uint8Array
}
export function createBeaconEncryptionKey(randomPrivateKey?: () => Uint8Array): {
  privateKey: Uint8Array
  publicKey: Uint8Array
}
export function encryptBeaconShare(
  share: bigint,
  recipientPublicKey: Uint8Array,
  network: string,
  epoch: bigint,
  sender: string,
  recipient: string,
  randomPrivateKey?: () => Uint8Array,
  randomNonce?: () => Uint8Array
): Promise<BeaconShareEnvelope>
export function decryptBeaconShare(
  envelope: BeaconShareEnvelope,
  recipientPrivateKey: Uint8Array,
  network: string,
  epoch: bigint,
  sender: string,
  recipient: string
): Promise<bigint>

import { secp256k1 } from '@noble/curves/secp256k1'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

const encoder = new TextEncoder()
const SCALAR_BYTES = 32

export type BeaconShareEnvelope = {
  ciphertext: Uint8Array
  ephemeralPublicKey: Uint8Array
  nonce: Uint8Array
}

const context = (network: string, epoch: bigint, sender: string, recipient: string) => {
  if (!network || epoch < 0n || !sender || !recipient || sender === recipient) {
    throw new TypeError('invalid beacon share envelope context')
  }
  return encoder.encode(`leofcoin-beacon-share-v1:${network}:${epoch}:${sender}:${recipient}`)
}

const scalarBytes = (share: bigint) => {
  if (share <= 0n || share >= secp256k1.CURVE.n) throw new RangeError('invalid beacon secret share')
  const output = new Uint8Array(SCALAR_BYTES)
  let value = share
  for (let index = output.length - 1; index >= 0; index -= 1) {
    output[index] = Number(value & 0xffn)
    value >>= 8n
  }
  return output
}

const bytesScalar = (bytes: Uint8Array) => {
  if (bytes.length !== SCALAR_BYTES) throw new Error('invalid decrypted beacon share length')
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)
  if (value <= 0n || value >= secp256k1.CURVE.n) throw new Error('invalid decrypted beacon share')
  return value
}

const encryptionKey = (privateKey: Uint8Array, publicKey: Uint8Array, aad: Uint8Array) => {
  if (!secp256k1.utils.isValidPrivateKey(privateKey)) throw new Error('invalid beacon encryption private key')
  const sharedSecret = secp256k1.getSharedSecret(privateKey, publicKey, true)
  return hkdf(sha256, sharedSecret, sha256(aad), aad, 32)
}

const importAesKey = (key: Uint8Array, usage: KeyUsage) =>
  globalThis.crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [usage])

export const createBeaconEncryptionKey = (randomPrivateKey = () => secp256k1.utils.randomPrivateKey()) => {
  const privateKey = randomPrivateKey()
  if (!secp256k1.utils.isValidPrivateKey(privateKey)) throw new Error('invalid generated beacon encryption key')
  return { privateKey, publicKey: secp256k1.getPublicKey(privateKey, true) }
}

export const encryptBeaconShare = async (
  share: bigint,
  recipientPublicKey: Uint8Array,
  network: string,
  epoch: bigint,
  sender: string,
  recipient: string,
  randomPrivateKey?: () => Uint8Array,
  randomNonce = () => globalThis.crypto.getRandomValues(new Uint8Array(12))
): Promise<BeaconShareEnvelope> => {
  const aad = context(network, epoch, sender, recipient)
  const ephemeral = createBeaconEncryptionKey(randomPrivateKey)
  const nonce = randomNonce()
  if (nonce.length !== 12) throw new Error('beacon share nonce must contain 12 bytes')
  const key = await importAesKey(encryptionKey(ephemeral.privateKey, recipientPublicKey, aad), 'encrypt')
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key,
    scalarBytes(share)
  )
  return { ciphertext: new Uint8Array(ciphertext), ephemeralPublicKey: ephemeral.publicKey, nonce }
}

export const decryptBeaconShare = async (
  envelope: BeaconShareEnvelope,
  recipientPrivateKey: Uint8Array,
  network: string,
  epoch: bigint,
  sender: string,
  recipient: string
): Promise<bigint> => {
  if (envelope.ephemeralPublicKey.length !== 33 || envelope.nonce.length !== 12 || envelope.ciphertext.length !== 48) {
    throw new Error('invalid beacon share envelope')
  }
  const aad = context(network, epoch, sender, recipient)
  const key = await importAesKey(encryptionKey(recipientPrivateKey, envelope.ephemeralPublicKey, aad), 'decrypt')
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: envelope.nonce, additionalData: aad, tagLength: 128 },
    key,
    envelope.ciphertext
  )
  return bytesScalar(new Uint8Array(plaintext))
}

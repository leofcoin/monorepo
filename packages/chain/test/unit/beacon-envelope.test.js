import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBeaconEncryptionKey,
  decryptBeaconShare,
  encryptBeaconShare
} from '../../src/consensus/beacon-envelope.ts'

const privateKey = (value) => () => {
  const bytes = new Uint8Array(32)
  bytes[31] = value
  return bytes
}
const nonce = () => new Uint8Array(12).fill(7)

test('encrypts a DKG share only for its epoch-bound recipient', async () => {
  const recipient = createBeaconEncryptionKey(privateKey(3))
  const envelope = await encryptBeaconShare(
    123456789n,
    recipient.publicKey,
    'leofcoin',
    4n,
    'validator-a',
    'validator-b',
    privateKey(5),
    nonce
  )
  assert.equal(
    await decryptBeaconShare(envelope, recipient.privateKey, 'leofcoin', 4n, 'validator-a', 'validator-b'),
    123456789n
  )
  await assert.rejects(() =>
    decryptBeaconShare(envelope, recipient.privateKey, 'leofcoin', 5n, 'validator-a', 'validator-b')
  )
  await assert.rejects(() =>
    decryptBeaconShare(envelope, recipient.privateKey, 'leofcoin', 4n, 'validator-a', 'validator-c')
  )
})

test('detects ciphertext and authentication-tag tampering', async () => {
  const recipient = createBeaconEncryptionKey(privateKey(3))
  const envelope = await encryptBeaconShare(
    42n,
    recipient.publicKey,
    'leofcoin',
    1n,
    'validator-a',
    'validator-b',
    privateKey(5),
    nonce
  )
  envelope.ciphertext[0] ^= 1
  await assert.rejects(() =>
    decryptBeaconShare(envelope, recipient.privateKey, 'leofcoin', 1n, 'validator-a', 'validator-b')
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import MultiWallet from '@leofcoin/multi-wallet'
import { bls12_381 as bls } from '@noble/curves/bls12-381'
import { toBase58 } from '@vandeurenglenn/typed-array-utils'

import {
  signBeaconActivationMessage,
  signBeaconCommitmentMessage,
  signBeaconShareMessage,
  validateBeaconActivationData,
  validateBeaconCommitmentData,
  validateBeaconShareData,
  verifyBeaconActivationMessage,
  verifyBeaconCommitmentMessage,
  verifyBeaconShareMessage
} from '../../src/consensus/beacon-wire.ts'

const identity = async () => {
  const wallet = new MultiWallet('leofcoin')
  await wallet.generate()
  return (await wallet.account(0)).external(0)
}

test('authenticates every public DKG commitment field', async () => {
  const signer = await identity()
  const message = {
    epoch: 3n,
    threshold: 2n,
    participant: 1n,
    from: await signer.address,
    commitments: [toBase58(bls.getPublicKey(11n)), toBase58(bls.getPublicKey(13n))]
  }
  const signature = await signBeaconCommitmentMessage('validators', message, signer)
  assert.equal(await verifyBeaconCommitmentMessage('validators', { ...message, signature }, 'leofcoin'), true)
  assert.equal(
    await verifyBeaconCommitmentMessage('validators', { ...message, epoch: 4n, signature }, 'leofcoin'),
    false
  )
})

test('authenticates and bounds threshold signature shares', async () => {
  const signer = await identity()
  const message = {
    epoch: 3n,
    round: 9n,
    participant: 1n,
    from: await signer.address,
    signatureShare: toBase58(bls.sign(new Uint8Array([1, 2, 3]), 11n))
  }
  const signature = await signBeaconShareMessage('validators', message, signer)
  assert.equal(await verifyBeaconShareMessage('validators', { ...message, signature }, 'leofcoin'), true)
  assert.equal(await verifyBeaconShareMessage('validators', { ...message, round: 10n, signature }, 'leofcoin'), false)
  assert.equal(validateBeaconShareData({ ...message, signatureShare: 'bad' }), false)
  assert.equal(validateBeaconCommitmentData({ ...message, threshold: 2n, commitments: [] }), false)
})

test('authenticates an epoch activation config digest', async () => {
  const signer = await identity()
  const message = {
    epoch: 7n,
    configDigest: toBase58(new Uint8Array(32).fill(9)),
    from: await signer.address
  }
  const signature = await signBeaconActivationMessage('validators', message, signer)
  assert.equal(await verifyBeaconActivationMessage('validators', { ...message, signature }, 'leofcoin'), true)
  assert.equal(
    await verifyBeaconActivationMessage('validators', { ...message, epoch: 8n, signature }, 'leofcoin'),
    false
  )
  assert.equal(validateBeaconActivationData({ ...message, configDigest: 'bad' }), false)
})

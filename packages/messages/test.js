import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BeaconActivationMessage,
  BeaconCommitmentMessage,
  BeaconShareMessage,
  BlockMessage,
  ContractMessage,
  PrecommitMessage,
  PrevoteMessage,
  ProposalMessage
} from './exports/index.js'

test('block messages round-trip all consensus fields', () => {
  const block = {
    index: 0n,
    previousHash: '0x0',
    timestamp: 1,
    reward: 0n,
    fees: 0n,
    transactions: ['transaction-hash'],
    validators: [{ address: 'validator', reward: 0n }],
    producer: 'validator',
    producerProof: 'producer-signature',
    protocolVersion: '0.2.0'
  }
  const decoded = new BlockMessage(new BlockMessage(block).encoded).decoded

  assert.equal(decoded.index, 0n)
  assert.equal(decoded.previousHash, '0x0')
  assert.deepEqual(decoded.transactions, ['transaction-hash'])
  assert.equal(decoded.producer, 'validator')
  assert.equal(decoded.producerProof, 'producer-signature')
  assert.equal(decoded.protocolVersion, '0.2.0')
})

test('contract messages round-trip', () => {
  const message = new ContractMessage({
    creator: 'creator',
    contract: new Uint8Array(),
    constructorParameters: []
  })
  const decoded = new ContractMessage(message.encoded).decoded
  assert.equal(decoded.creator, 'creator')
})

for (const [name, Message] of [
  ['proposal', ProposalMessage],
  ['prevote', PrevoteMessage],
  ['precommit', PrecommitMessage]
]) {
  test(`${name} messages preserve validator signatures`, () => {
    const decoded = new Message(
      new Message({
        blockHash: 'block-hash',
        index: 1n,
        round: 0n,
        from: 'validator',
        signature: 'signature'
      }).encoded
    ).decoded
    assert.equal(decoded.signature, 'signature')
  })
}

test('beacon consensus messages preserve signed round data', () => {
  const activation = new BeaconActivationMessage({
    epoch: 3n,
    configDigest: 'config-digest',
    from: 'validator-2',
    signature: 'identity-signature'
  })
  assert.deepEqual(new BeaconActivationMessage(activation.encoded).decoded, activation.decoded)
  const commitment = new BeaconCommitmentMessage({
    epoch: 3n,
    threshold: 3n,
    participant: 2n,
    from: 'validator-2',
    commitments: ['commitment-a', 'commitment-b', 'commitment-c'],
    signature: 'identity-signature'
  })
  assert.deepEqual(new BeaconCommitmentMessage(commitment.encoded).decoded, commitment.decoded)

  const share = new BeaconShareMessage({
    epoch: 3n,
    round: 8n,
    participant: 2n,
    from: 'validator-2',
    signatureShare: 'threshold-signature-share',
    signature: 'identity-signature'
  })
  assert.deepEqual(new BeaconShareMessage(share.encoded).decoded, share.decoded)
})

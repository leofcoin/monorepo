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

test('binary validator framing preserves the pre-migration block bytes and hash', async () => {
  const block = {
    index: 7n,
    previousHash: '0x0',
    timestamp: 1700000000000,
    reward: 150n,
    fees: 10n,
    transactions: ['tx-hash'],
    validators: [
      { address: 'validator-a', reward: 150n },
      { address: 'validator-b', reward: 1000000000000000000n }
    ],
    producer: 'validator-a',
    producerProof: 'proof',
    protocolVersion: '0.3.0'
  }
  const hex =
    'edc4010137033078300d31373030303030303030303030033135300231300b5b2274782d68617368225d3813edec010b76616c696461746f722d610331353023edec010b76616c696461746f722d6213313030303030303030303030303030303030300b76616c696461746f722d610570726f6f6605302e332e30'
  const message = new BlockMessage(block)
  assert.equal(Buffer.from(message.encoded).toString('hex'), hex)
  assert.equal(await message.hash(), 'BA5XCACGLXGXMA5YT2H3YRYWIQMX5KQGFSODANJZ337OV3XLTMBVLV6XZS')
  assert.deepEqual(new BlockMessage(new Uint8Array(Buffer.from(hex, 'hex'))).decoded.validators, block.validators)
})

test('block messages preserve empty and large validator lists without recursive framing', () => {
  for (const count of [0, 10000]) {
    const block = {
      index: 0n,
      previousHash: '0x0',
      timestamp: 1,
      reward: 0n,
      fees: 0n,
      transactions: [],
      validators: Array.from({ length: count }, (_, index) => ({ address: `validator-${index}`, reward: 0n })),
      producer: 'validator',
      producerProof: 'proof',
      protocolVersion: '0.3.0'
    }
    const message = new BlockMessage(block)
    assert.deepEqual(new BlockMessage(message.encoded).decoded.validators, block.validators)
  }
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

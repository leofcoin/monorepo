import assert from 'node:assert/strict'
import test from 'node:test'

import { BlockMessage, ContractMessage, PrecommitMessage, PrevoteMessage, ProposalMessage } from './exports/index.js'

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

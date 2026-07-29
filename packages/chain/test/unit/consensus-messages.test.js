import assert from 'node:assert/strict'
import test from 'node:test'

import { PrecommitMessage, PrevoteMessage, ProposalMessage } from '@leofcoin/messages'

for (const [name, Message] of [
  ['proposal', ProposalMessage],
  ['prevote', PrevoteMessage],
  ['precommit', PrecommitMessage]
]) {
  test(`${name} wire format preserves its validator signature`, () => {
    const encoded = new Message({
      blockHash: 'block-hash',
      index: 42n,
      round: 2n,
      from: 'validator-address',
      signature: 'validator-signature'
    }).encoded
    const decoded = new Message(encoded).decoded

    assert.equal(decoded.blockHash, 'block-hash')
    assert.equal(decoded.index, 42n)
    assert.equal(decoded.round, 2n)
    assert.equal(decoded.from, 'validator-address')
    assert.equal(decoded.signature, 'validator-signature')
  })
}

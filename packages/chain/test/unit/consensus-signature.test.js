import assert from 'node:assert/strict'
import test from 'node:test'

import MultiWallet from '@leofcoin/multi-wallet'

import { signConsensusMessage, verifyConsensusMessage } from '../../src/consensus/signature.ts'

const originalConsoleLog = console.log
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[decode]')) return
  originalConsoleLog(...args)
}
test.after(() => {
  console.log = originalConsoleLog
})

test('consensus signatures authenticate every signed field', async () => {
  const network = 'leofcoin'
  const wallet = new MultiWallet(network)
  await wallet.generate()
  const identity = await (await wallet.account(0)).external(0)
  const from = await identity.address
  const validatorsAddress = 'validators-contract'
  const message = { blockHash: 'block-hash', index: 42n, round: 3n, from }
  const signature = await signConsensusMessage(validatorsAddress, 'prevote', message, identity)

  assert.equal(
    await verifyConsensusMessage(validatorsAddress, 'prevote', { ...message, signature }, network),
    true
  )
  assert.equal(
    await verifyConsensusMessage(validatorsAddress, 'prevote', { ...message, blockHash: 'other', signature }, network),
    false
  )
  assert.equal(
    await verifyConsensusMessage(validatorsAddress, 'precommit', { ...message, signature }, network),
    false
  )
  assert.equal(
    await verifyConsensusMessage(validatorsAddress, 'prevote', { ...message, round: 4n, signature }, network),
    false
  )
})

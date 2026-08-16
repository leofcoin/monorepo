import assert from 'node:assert/strict'
import test from 'node:test'

import { TransactionMessage } from '@leofcoin/messages'

import { resolveTransactionReference } from '../../src/consensus/transaction-reference.ts'

const transaction = {
  from: 'sender',
  to: 'receiver',
  method: 'transfer',
  params: ['receiver', 1n],
  timestamp: 1,
  nonce: 1,
  signature: 'signature'
}

test('accepts transaction bytes that match the block reference', async () => {
  const message = new TransactionMessage(transaction)
  const hash = await message.hash()

  const resolved = await resolveTransactionReference(hash, message.encoded)

  assert.equal(await resolved.hash(), hash)
  assert.equal(resolved.decoded.from, transaction.from)
  assert.equal(resolved.decoded.nonce, transaction.nonce)
})

test('rejects valid transaction bytes served for a different block reference', async () => {
  const message = new TransactionMessage(transaction)

  await assert.rejects(
    resolveTransactionReference('BA5XWRONGTRANSACTIONREFERENCE', message.encoded),
    /Transaction hash mismatch/
  )
})

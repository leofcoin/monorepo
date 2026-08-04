import assert from 'node:assert/strict'
import test from 'node:test'
import { TransactionMessage } from '@leofcoin/messages'

import {
  TRANSACTION_FEE_BYTES,
  TRANSACTION_FEE_UNIT,
  FEE_PROTOCOL_VERSION,
  aggregateValidatorFees,
  calculateFee,
  distributeTransactionFee,
  supportsTransactionFees
} from '@leofcoin/lib'

test('transaction fees activate only at the protocol boundary', () => {
  assert.equal(FEE_PROTOCOL_VERSION, '1.10.9')
  assert.equal(supportsTransactionFees('1.10.8'), false)
  assert.equal(supportsTransactionFees('1.10.9'), true)
  assert.equal(supportsTransactionFees('1.11.0'), true)
  assert.equal(supportsTransactionFees('invalid'), false)
})

test('charges the smallest non-zero fee per started KiB, including validator calls', async () => {
  const transaction = new TransactionMessage({
    from: 'sender',
    to: 'validators-contract',
    method: 'participate',
    params: ['x'.repeat(2_048)],
    timestamp: 1,
    nonce: 1,
    signature: 'signature'
  })
  const expectedUnits =
    (BigInt(transaction.encoded.length) + TRANSACTION_FEE_BYTES - 1n) / TRANSACTION_FEE_BYTES

  assert.equal(await calculateFee(transaction), expectedUnits * TRANSACTION_FEE_UNIT)
  assert.ok((await calculateFee(transaction)) > 0n)
})

test('splits the minimum fee 90/10 and preserves every atom', () => {
  const result = distributeTransactionFee(10n, 'transaction-a', ['c', 'a', 'b'])

  assert.equal(result.burned, 1n)
  assert.equal([...result.validatorFees.values()].reduce((sum, amount) => sum + amount, 0n), 9n)
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.amount, result.burned), 10n)
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.amount, 0n), 9n)
})

test('rotates indivisible validator atoms deterministically across transaction hashes', () => {
  const first = distributeTransactionFee(11n, 'transaction-a', ['a', 'b', 'c']).validatorFees
  const repeated = distributeTransactionFee(11n, 'transaction-a', ['c', 'b', 'a']).validatorFees
  const second = distributeTransactionFee(11n, 'transaction-b', ['a', 'b', 'c']).validatorFees

  assert.deepEqual(first, repeated)
  assert.notDeepEqual(first, second)
})

test('aggregates validator payouts from every transaction', () => {
  const totals = aggregateValidatorFees(
    [
      { fee: 10n, transactionHash: 'transaction-a' },
      { fee: 20n, transactionHash: 'transaction-b' }
    ],
    ['a', 'b', 'c']
  )

  assert.equal([...totals.values()].reduce((sum, amount) => sum + amount, 0n), 27n)
})

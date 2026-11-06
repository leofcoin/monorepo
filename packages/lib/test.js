import assert from 'node:assert/strict'
import test from 'node:test'
import MultiWallet from '@leofcoin/multi-wallet'
import { nativeToken } from '@leofcoin/addresses'
import { TransactionMessage } from '@leofcoin/messages'
import { fromBase58, toBase58 } from '@vandeurenglenn/typed-array-utils'
import { calculateFee, createTransactionHash, signTransaction, TRANSACTION_FEE_BYTES, TRANSACTION_FEE_UNIT } from './exports/index.js'
import { formatUnits } from '@leofcoin/utils'

async function signedTransfer() {
  // Public test-only seed; entirely in memory, with no identity or chain store.
  const wallet = new MultiWallet('leofcoin')
  await wallet.fromPrivateKey(new Uint8Array(32).fill(7), undefined, 'leofcoin')
  const from = await wallet.address
  const raw = { from, to: nativeToken, method: 'transfer', params: [from, 10n ** 18n], nonce: 1, timestamp: 1 }
  return { raw, signed: await signTransaction(raw, wallet), wallet }
}

test('fees use the canonical binary size for signed objects, messages and encoded bytes', async () => {
  const { signed } = await signedTransfer()
  const message = new TransactionMessage(signed)
  assert.equal(typeof signed.signature, 'string')
  assert.equal(toBase58(fromBase58(signed.signature)), signed.signature)
  assert.ok(message.encoded instanceof Uint8Array)
  const bytes = BigInt(message.encoded.length)
  const expected = ((bytes + TRANSACTION_FEE_BYTES - 1n) / TRANSACTION_FEE_BYTES) * TRANSACTION_FEE_UNIT
  assert.equal(await calculateFee(signed), expected)
  assert.equal(await calculateFee(message), expected)
  assert.equal(await calculateFee(message.encoded), expected)
  assert.equal(await calculateFee(signed, true), formatUnits(expected.toString()))
})

test('signatures verify against the same canonical hash before and after binary round-trip', async () => {
  const { raw, signed, wallet } = await signedTransfer()
  const decoded = new TransactionMessage(new TransactionMessage(signed).encoded)
  const hash = await createTransactionHash(raw)
  assert.ok(hash instanceof Uint8Array)
  assert.deepEqual(await createTransactionHash(signed), hash)
  assert.deepEqual(await createTransactionHash(decoded), hash)
  assert.equal(await wallet.verify(fromBase58(decoded.decoded.signature), hash), true)
  const tampered = { ...signed, params: [raw.from, 2n * 10n ** 18n] }
  assert.equal(await wallet.verify(fromBase58(signed.signature), await createTransactionHash(tampered)), false)
})

test('legacy byte-array signatures remain invalid rather than weakening the message schema', async () => {
  const { signed } = await signedTransfer()
  await assert.rejects(calculateFee({ ...signed, signature: fromBase58(signed.signature) }), /Message field type mismatch/)
})

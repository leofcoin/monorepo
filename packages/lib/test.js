import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import MultiWallet from '@leofcoin/multi-wallet'
import { nativeToken } from '@leofcoin/addresses'
import { TransactionMessage } from '@leofcoin/messages'
import { fromBase58, toBase58 } from '@vandeurenglenn/typed-array-utils'
import { calculateFee, createTransactionHash, signTransaction, signTransactions, TRANSACTION_FEE_BYTES, TRANSACTION_FEE_UNIT } from './exports/index.js'
import { formatUnits } from '@leofcoin/utils'

test('signing declarations support async wallets and preserve optional nonces', () => {
  const fixture = fileURLToPath(new URL('./type-fixtures/signing.ts', import.meta.url))
  const program = ts.createProgram([fixture], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext
  })
  const errors = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.file?.fileName === fixture)
  assert.deepEqual(errors.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [])
})

async function signedTransfer() {
  // Public test-only seed; entirely in memory, with no identity or chain store.
  const wallet = new MultiWallet('leofcoin')
  await wallet.fromPrivateKey(new Uint8Array(32).fill(7), undefined, 'leofcoin')
  const from = await wallet.address
  const raw = { from, to: nativeToken, method: 'transfer', params: [from, 10n ** 18n], nonce: 1, timestamp: 1 }
  return { raw, signed: await signTransaction(raw, wallet), wallet }
}

test('bounded concurrent signing preserves order and snapshots inputs', async () => {
  const { raw, wallet } = await signedTransfer()
  let active = 0, maximum = 0
  const signer = {
    async sign(hash) {
      active++
      maximum = Math.max(maximum, active)
      await new Promise(resolve => setImmediate(resolve))
      try { return await wallet.sign(hash) } finally { active-- }
    }
  }
  const input = Array.from({ length: 5 }, (_, index) => ({ ...raw, params: [...raw.params], nonce: index + 1 }))
  const signing = signTransactions(input, signer, 2)
  input[0].params[1] = 999n
  const result = await signing
  assert.equal(maximum, 2)
  assert.deepEqual(result.map(transaction => transaction.nonce), [1, 2, 3, 4, 5])
  assert.equal(result[0].params[1], raw.params[1])
  for (const transaction of result)
    assert.equal(await wallet.verify(fromBase58(transaction.signature), await createTransactionHash(transaction)), true)
  await assert.rejects(signTransactions(input, signer, 0), /concurrency/)
})

test('a signing failure drains in-flight operations before rejecting', async () => {
  const { raw } = await signedTransfer()
  let active = 0, started = 0
  const failure = new Error('signer unavailable')
  const signer = { async sign() {
    active++
    const index = started++
    try {
      await new Promise(resolve => setImmediate(resolve))
      if (index === 0) throw failure
      return Uint8Array.of(1)
    } finally { active-- }
  } }
  await assert.rejects(signTransactions(Array.from({ length: 10 }, () => raw), signer, 2), error => error === failure)
  assert.equal(active, 0)
  assert.equal(started, 2)
})

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

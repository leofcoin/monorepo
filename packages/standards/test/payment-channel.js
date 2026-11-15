import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'
import test from 'node:test'
import MultiWallet from '@leofcoin/multi-wallet'
import { assertPaymentChannelTransition, encodePaymentChannelState, verifyPaymentChannelUpdate } from '@leofcoin/standards/payment-channel'

const state = () => ({
  chainId: 'genesis-hash', escrow: 'escrow', channelId: 'unique-funding-id',
  token: 'LFC', payer: 'alice', payee: 'merchant', deposit: 100n,
  expiresAt: 1_800_000_000_000, challengePeriodMs: 86_400_000,
  sequence: 1n, paid: 10n
})
const digest = value => createHash('sha256').update(encodePaymentChannelState(value)).digest()

test('canonical channel signatures bind the funding domain, participants, limits and update', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const initial = state()
  const reordered = Object.fromEntries(Object.entries(initial).reverse())
  assert.deepEqual(encodePaymentChannelState(reordered), encodePaymentChannelState(initial))
  const signature = sign(null, digest(initial), privateKey)
  assert.equal(verify(null, digest(initial), publicKey, signature), true)
  for (const [field, changed] of Object.entries({
    chainId: 'other-chain', escrow: 'other-escrow', channelId: 'other-funding',
    token: 'other-token', payer: 'other-payer', payee: 'other-payee', deposit: 101n,
    expiresAt: initial.expiresAt + 1, challengePeriodMs: initial.challengePeriodMs + 1,
    sequence: 2n, paid: 11n
  }))
    assert.equal(verify(null, digest({ ...initial, [field]: changed }), publicKey, signature), false, field)
})

test('channel transitions reject replay, changed terms, declining claims and overdraws', () => {
  const previous = state()
  assert.doesNotThrow(() => assertPaymentChannelTransition(previous, { ...previous, sequence: 2n, paid: 20n }))
  for (const changes of [
    { sequence: 1n }, { sequence: 0n }, { sequence: 2n, paid: 9n },
    { sequence: 2n, paid: 101n }, { sequence: 2n, deposit: 200n },
    { sequence: 2n, channelId: 'reopened-channel' },
    { sequence: 2n, expiresAt: previous.expiresAt + 1 }
  ])
    assert.throws(() => assertPaymentChannelTransition(previous, { ...previous, ...changes }))
})

test('channel payloads reject ambiguous or unbounded values before signing', () => {
  for (const changes of [
    { deposit: '100' }, { paid: -1n }, { sequence: 0n }, { sequence: 1n << 256n },
    { expiresAt: Number.NaN }, { challengePeriodMs: 0 }, { chainId: ' ' },
    { escrow: 'x'.repeat(513) }, { payee: 'alice' }
  ])
    assert.throws(() => encodePaymentChannelState({ ...state(), ...changes }))
})

test('accepts only a valid payer signature for trusted channel terms and a newer unexpired state', async () => {
  const payer = new MultiWallet('leofcoin')
  await payer.fromPrivateKey(new Uint8Array(32).fill(7), undefined, 'leofcoin')
  const other = new MultiWallet('leofcoin')
  await other.fromPrivateKey(new Uint8Array(32).fill(8), undefined, 'leofcoin')
  const previous = { ...state(), payer: await payer.address, sequence: 0n, paid: 0n }
  const next = { ...previous, sequence: 1n, paid: 10n }
  const signature = await payer.sign(digest(next))
  const verifier = async (address, hash, encoded) => {
    const wallet = new MultiWallet('leofcoin')
    await wallet.fromAddress(address, null, 'leofcoin')
    return wallet.verify(encoded, hash)
  }
  assert.deepEqual(await verifyPaymentChannelUpdate(previous, next, signature, next.expiresAt - 1, verifier), next)
  await assert.rejects(verifyPaymentChannelUpdate(previous, next, await other.sign(digest(next)), 1, verifier), /signature/)
  await assert.rejects(verifyPaymentChannelUpdate(previous, { ...next, paid: 11n }, signature, 1, verifier), /signature/)
  await assert.rejects(verifyPaymentChannelUpdate(previous, { ...next, channelId: 'other' }, signature, 1, verifier), /channelId/)
  await assert.rejects(verifyPaymentChannelUpdate(next, next, signature, 1, verifier), /sequence/)
  await assert.rejects(verifyPaymentChannelUpdate(previous, next, signature, next.expiresAt, verifier), /expired/)
})

test('snapshots update and signature before asynchronous verification', async () => {
  const previous = { ...state(), sequence: 0n, paid: 0n }
  const next = { ...previous, sequence: 1n, paid: 10n }
  const signature = Buffer.from([1, 2, 3])
  let release
  const gate = new Promise(resolve => { release = resolve })
  const pending = verifyPaymentChannelUpdate(previous, next, signature, 1, async (payer, hash, bytes) => {
    await gate
    assert.equal(payer, previous.payer)
    assert.deepEqual(hash, Uint8Array.from(digest({ ...previous, sequence: 1n, paid: 10n })))
    assert.deepEqual(bytes, Uint8Array.of(1, 2, 3))
    return true
  })
  next.paid = 99n
  signature[0] = 9
  release()
  assert.equal((await pending).paid, 10n)
})

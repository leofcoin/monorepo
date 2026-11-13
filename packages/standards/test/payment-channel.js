import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'
import test from 'node:test'
import { assertPaymentChannelTransition, encodePaymentChannelState } from '@leofcoin/standards/payment-channel'

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

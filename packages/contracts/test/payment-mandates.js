import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import PaymentMandates from '../exports/payment-mandates.js'
import Leofcoin from '../exports/native-token.js'

describe('PaymentMandates preparation', () => {
  const owner = 'owner', merchant = 'merchant', contract = 'mandates', tokenAddress = 'LFC'
  let token, mandates, now

  beforeEach(t => {
    now = 1_700_000_000_000
    t.mock.method(Date, 'now', () => now)
    globalThis.msg = { sender: owner, contract }
    token = new Leofcoin(10_000n, 1_000n, [{ address: owner, amount: 1_000n }])
    token.approve(contract, 1_000n)
    mandates = new PaymentMandates(tokenAddress)
    globalThis.msg.call = async (target, method, params) => {
      assert.equal(target, tokenAddress)
      assert.equal(method, 'transferFrom')
      const previous = globalThis.msg
      globalThis.msg = { sender: contract, contract: tokenAddress }
      try {
        return token.transferFrom(...params)
      } finally {
        globalThis.msg = previous
      }
    }
  })

  const create = () => mandates.createMandate(merchant, 100n, 1_000, now + 10_000, 250n)

  it('charges only within fixed-window and lifetime caps using the real LFC approval', async () => {
    const id = create()
    assert.equal(token.balanceOf(owner), 1_000n, 'creation must not lock or move funds')
    msg.sender = merchant
    await mandates.charge(id, 60n)
    await mandates.charge(id, 40n)
    await assert.rejects(mandates.charge(id, 1n), /period limit/)
    now += 1_000
    await mandates.charge(id, 100n)
    now -= 1_000
    await assert.rejects(mandates.charge(id, 1n), /time moved backwards/)
    now += 1_000
    now += 1_000
    await assert.rejects(mandates.charge(id, 51n), /total limit/)
    await mandates.charge(id, 50n)
    assert.equal(token.balanceOf(merchant), 250n)
    assert.equal(token.balanceOf(owner), 750n)
    assert.equal(token.allowance(owner, contract), 750n)
    assert.equal(mandates.getMandate(id).totalSpent, 250n)
  })

  it('restricts charging to the merchant and revocation to the owner', async () => {
    const id = create()
    await assert.rejects(mandates.charge(id, 1n), /only the mandate merchant/)
    msg.sender = merchant
    assert.throws(() => mandates.revokeMandate(id), /only the mandate owner/)
    await mandates.charge(id, 10n)
    msg.sender = owner
    mandates.revokeMandate(id)
    msg.sender = merchant
    await assert.rejects(mandates.charge(id, 1n), /revoked/)
    assert.equal(token.balanceOf(merchant), 10n, 'revocation must not reverse prior payments')
  })

  it('does not consume spending capacity after an allowance failure', async () => {
    const id = create()
    token.approve(contract, 0n)
    msg.sender = merchant
    const previous = mandates.state
    await assert.rejects(mandates.charge(id, 50n), /allowance/)
    assert.deepEqual(mandates.state, previous)
    msg.sender = owner
    token.approve(contract, 50n)
    msg.sender = merchant
    await mandates.charge(id, 50n)
    assert.equal(mandates.getMandate(id).totalSpent, 50n)
  })

  it('blocks reentrant charges and mandate mutation during token calls', async () => {
    const id = create()
    const call = msg.call
    msg.call = async (...args) => {
      await assert.rejects(mandates.charge(id, 1n), /reentrant/)
      assert.throws(() => mandates.revokeMandate(id), /reentrant/)
      assert.throws(create, /reentrant/)
      return call(...args)
    }
    msg.sender = merchant
    await mandates.charge(id, 50n)
    assert.equal(token.balanceOf(merchant), 50n)
  })

  it('restores spent limits, isolates returned state and expires at the exact deadline', async () => {
    const id = create()
    const expiresAt = mandates.getMandate(id).expiresAt
    msg.sender = merchant
    await mandates.charge(id, 60n)
    const saved = mandates.state
    mandates = new PaymentMandates(tokenAddress, saved)
    saved.mandates[id].periodSpent = 0n
    mandates.getMandate(id).periodSpent = 0n
    await assert.rejects(mandates.charge(id, 41n), /period limit/)
    await mandates.charge(id, 40n)
    now = expiresAt
    await assert.rejects(mandates.charge(id, 1n), /not active/)
    assert.throws(() => new PaymentMandates('other-token', mandates.state), /token mismatch/)
  })

  it('rejects invalid mandate terms and unknown identifiers without moving funds', async () => {
    assert.throws(() => mandates.createMandate(owner, 100n, 1_000, now + 1_000, 100n), /merchant/)
    assert.throws(() => mandates.createMandate(merchant, 0n, 1_000, now + 1_000, 100n), /positive/)
    assert.throws(() => mandates.createMandate(merchant, 100n, 0, now + 1_000, 100n), /period/)
    assert.throws(() => mandates.createMandate(merchant, 100n, 1_000, now, 100n), /expiry/)
    assert.throws(() => mandates.getMandate(1n), /not found/)
    assert.equal(token.balanceOf(owner), 1_000n)
  })
})

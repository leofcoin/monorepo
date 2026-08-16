import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import Leofcoin, { MONETARY_POLICY_AUTHORITY } from './../exports/native-token.js'

describe('Leofcoin', () => {
  let token
  const receiverAddress = '0xReceiverAddress'
  const otherReceiverAddress = '0xOtherReceiverAddress'
  const ownerAddress = '0xOwnerAddress'
  const targetSupply = 10_000_000n
  const initialSupply = 1_000_000n
  const allocations = [
    { address: receiverAddress, amount: 400_000n },
    { address: ownerAddress, amount: 600_000n }
  ]

  beforeEach(() => {
    global.msg = {
      sender: ownerAddress,
      contract: '0xContractAddress',
      staticCall: async () => {},
      call: async () => {}
    }

    token = new Leofcoin(targetSupply, initialSupply, allocations)
  })

  it('creates the complete initial supply directly from deterministic allocations', () => {
    assert.ok(token instanceof Leofcoin)
    assert.equal(token.name, 'Leofcoin')
    assert.equal(token.symbol, 'LFC')
    assert.equal(token.decimals, 18)
    assert.equal(token.targetSupply, targetSupply)
    assert.equal(token.initialSupply, initialSupply)
    assert.equal(token.totalSupply, initialSupply)
    assert.equal(token.balanceOf(ownerAddress), 600_000n)
    assert.equal(token.balanceOf(receiverAddress), 400_000n)
    assert.equal(token.holders, 2n)
  })

  it('sorts allocations so equivalent genesis inputs produce identical state', () => {
    const reversed = new Leofcoin(targetSupply, initialSupply, [...allocations].reverse())
    assert.deepEqual(reversed.balances, token.balances)
  })

  it('persists the immutable supplies when restoring state', () => {
    msg.sender = MONETARY_POLICY_AUTHORITY
    token.mint(ownerAddress, 100n)
    const restored = new Leofcoin(999n, token.state)
    assert.equal(restored.targetSupply, targetSupply)
    assert.equal(restored.initialSupply, initialSupply)
    assert.equal(restored.totalSupply, initialSupply + 100n)
    assert.equal(restored.balanceOf(ownerAddress), 600_100n)
  })

  it('reserves mint and burn authority for the monetary protocol', () => {
    assert.equal(token.hasRole(ownerAddress, 'OWNER'), true)
    assert.equal(token.hasRole(ownerAddress, 'MINT'), false)
    assert.equal(token.hasRole(ownerAddress, 'BURN'), false)
    assert.equal(token.hasRole(MONETARY_POLICY_AUTHORITY, 'MINT'), true)
    assert.equal(token.hasRole(MONETARY_POLICY_AUTHORITY, 'BURN'), true)
  })

  it('prevents the owner from minting or burning', () => {
    assert.throws(() => token.mint(ownerAddress, 1n), {
      message: 'only the monetary protocol may mint'
    })
    assert.throws(() => token.burn(ownerAddress, 1n), {
      message: 'only the monetary protocol may burn'
    })
  })

  it('makes protocol monetary roles immutable', () => {
    assert.throws(() => token.grantRole(ownerAddress, 'MINT'), {
      message: 'protocol monetary roles are immutable'
    })
    assert.throws(() => token.revokeRole(MONETARY_POLICY_AUTHORITY, 'BURN'), {
      message: 'protocol monetary roles are immutable'
    })
  })

  it('allows protocol-controlled minting and burning', () => {
    msg.sender = MONETARY_POLICY_AUTHORITY
    token.mint(ownerAddress, 100_000n)
    token.burn(ownerAddress, 10_000n)
    assert.equal(token.balanceOf(ownerAddress), 690_000n)
    assert.equal(token.totalSupply, 1_090_000n)
  })

  it('allows allocated holders to transfer', () => {
    msg.sender = receiverAddress
    token.transfer(otherReceiverAddress, 10_000n)
    assert.equal(token.balanceOf(receiverAddress), 390_000n)
    assert.equal(token.balanceOf(otherReceiverAddress), 10_000n)
  })

  it('rejects invalid genesis allocation sets', () => {
    assert.throws(() => new Leofcoin(targetSupply, initialSupply, []), {
      message: 'genesis allocations are required'
    })
    assert.throws(
      () =>
        new Leofcoin(targetSupply, initialSupply, [
          { address: ownerAddress, amount: initialSupply - 1n }
        ]),
      { message: /genesis allocations must equal initial supply/ }
    )
    assert.throws(
      () =>
        new Leofcoin(targetSupply, initialSupply, [
          { address: ownerAddress, amount: 500_000n },
          { address: ownerAddress, amount: 500_000n }
        ]),
      { message: 'invalid or duplicate genesis address' }
    )
    assert.throws(() => new Leofcoin(1n, 2n, [{ address: ownerAddress, amount: 2n }]), {
      message: 'initial supply must be positive and not exceed target supply'
    })
  })

  it('rejects invalid monetary amounts', () => {
    msg.sender = MONETARY_POLICY_AUTHORITY
    assert.throws(() => token.mint(ownerAddress, 0n), { message: 'mint amount must be positive' })
    assert.throws(() => token.mint(ownerAddress, targetSupply), {
      message: 'mint exceeds target supply'
    })
    assert.throws(() => token.burn(ownerAddress, 0n), { message: 'burn amount must be positive' })
    assert.throws(() => token.burn(ownerAddress, 600_001n), { message: 'amount exceeds balance' })
  })
})

import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import MockToken from '../exports/mock-token.js'

describe('MockToken', () => {
  const owner = '0xOwner'
  const alice = '0xAlice'

  beforeEach(() => {
    global.msg = { sender: owner }
  })

  it('creates mock WETH, WBNB and USDC with their conventional decimals', () => {
    const assets = [
      new MockToken('Mock Wrapped Ether', 'WETH', 18, 1_000_000n),
      new MockToken('Mock Wrapped BNB', 'WBNB', 18, 2_000_000n),
      new MockToken('Mock USD Coin', 'USDC', 6, 3_000_000n)
    ]

    assert.deepEqual(
      assets.map((asset) => [asset.symbol, asset.decimals, asset.balanceOf(owner)]),
      [
        ['WETH', 18, 1_000_000n],
        ['WBNB', 18, 2_000_000n],
        ['USDC', 6, 3_000_000n]
      ]
    )
  })

  it('supports transfers, allowances and deterministic state restoration', () => {
    const token = new MockToken('Mock USD Coin', 'USDC', 6, 1_000_000n)
    token.transfer(alice, 100_000n)
    token.approve(alice, 25_000n)

    const restored = new MockToken('Mock USD Coin', 'USDC', 6, 1_000_000n, [], token.state)

    assert.equal(restored.balanceOf(owner), 900_000n)
    assert.equal(restored.balanceOf(alice), 100_000n)
    assert.equal(restored.allowance(owner, alice), 25_000n)
    assert.equal(restored.totalSupply, 1_000_000n)
  })

  it('rejects allocations that do not match the declared supply', () => {
    assert.throws(() => new MockToken('Mock USD Coin', 'USDC', 6, 1_000_000n, [{ address: owner, amount: 1n }]), {
      message: 'allocations must equal initial supply: expected 1000000, got 1'
    })
  })
})

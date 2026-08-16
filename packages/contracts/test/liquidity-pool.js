import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import LiquidityPool from '../exports/liquidity-pool.js'
import MockToken from '../exports/mock-token.js'

describe('LiquidityPool', () => {
  const poolAddress = '0xPool'
  const token0 = '0xToken0'
  const token1 = '0xToken1'
  const alice = '0xAlice'
  const bob = '0xBob'
  let pool
  let balances
  let allowances

  const balanceOf = (token, account) => balances[token][account] ?? 0n
  const allowanceOf = (token, owner, operator) => allowances[token][owner]?.[operator] ?? 0n

  beforeEach(() => {
    balances = {
      [token0]: { [alice]: 100_000n, [bob]: 100_000n },
      [token1]: { [alice]: 100_000n, [bob]: 100_000n }
    }
    allowances = {
      [token0]: {
        [alice]: { [poolAddress]: 100_000n },
        [bob]: { [poolAddress]: 100_000n }
      },
      [token1]: {
        [alice]: { [poolAddress]: 100_000n },
        [bob]: { [poolAddress]: 100_000n }
      }
    }
    global.msg = {
      sender: alice,
      contract: poolAddress,
      call: async (contract, method, params) => {
        if (method === 'transferFrom') {
          const [owner, receiver, amount] = params
          const approved = allowanceOf(contract, owner, poolAddress)
          if (approved < amount) throw new Error('amount exceeds allowance')
          if (balanceOf(contract, owner) < amount) throw new Error('amount exceeds balance')
          allowances[contract][owner][poolAddress] = approved - amount
          balances[contract][owner] -= amount
          balances[contract][receiver] = balanceOf(contract, receiver) + amount
          return
        }
        if (method === 'transfer') {
          const [receiver, amount] = params
          if (balanceOf(contract, poolAddress) < amount) throw new Error('amount exceeds balance')
          balances[contract][poolAddress] -= amount
          balances[contract][receiver] = balanceOf(contract, receiver) + amount
          return
        }
        throw new Error(`unsupported token method: ${method}`)
      }
    }
    pool = new LiquidityPool(token0, token1)
  })

  it('adds balanced initial liquidity using approvals', async () => {
    const result = await pool.addLiquidity(10_000n, 10_000n, 10_000n)

    assert.deepEqual(result, {
      amount0: 10_000n,
      amount1: 10_000n,
      liquidity: 10_000n
    })
    assert.deepEqual(pool.reserves, [10_000n, 10_000n])
    assert.equal(pool.liquidityOf(alice), 10_000n)
    assert.equal(balanceOf(token0, poolAddress), 10_000n)
    assert.equal(balanceOf(token1, poolAddress), 10_000n)
  })

  it('accepts only the proportional part of later liquidity', async () => {
    await pool.addLiquidity(10_000n, 20_000n)
    global.msg.sender = bob

    const result = await pool.addLiquidity(10_000n, 30_000n)

    assert.deepEqual(result, {
      amount0: 10_000n,
      amount1: 20_000n,
      liquidity: 14_142n
    })
    assert.deepEqual(pool.reserves, [20_000n, 40_000n])
    assert.equal(balanceOf(token1, bob), 80_000n)
  })

  it('swaps with a constant-product fee and enforces slippage', async () => {
    await pool.addLiquidity(10_000n, 10_000n)
    global.msg.sender = bob

    const quoted = pool.getAmountOut(token0, 1_000n)
    assert.equal(quoted, 906n)
    const productBefore = pool.reserve0 * pool.reserve1
    await assert.rejects(pool.swapExactTokensForTokens(token0, 1_000n, 907n, bob, Date.now()), {
      message: 'minimum output amount not met'
    })

    const received = await pool.swapExactTokensForTokens(token0, 1_000n, 906n, bob, Date.now())
    assert.equal(received, 906n)
    assert.deepEqual(pool.reserves, [11_000n, 9_094n])
    assert.ok(pool.reserve0 * pool.reserve1 > productBefore)
    assert.equal(balanceOf(token1, bob), 100_906n)
  })

  it('rejects expired swaps', async () => {
    await pool.addLiquidity(10_000n, 10_000n)
    await assert.rejects(pool.swapExactTokensForTokens(token0, 1_000n, 1n, alice, Date.now() - 1), {
      message: 'swap expired'
    })
  })

  it('returns the provider share and can restore its state', async () => {
    await pool.addLiquidity(10_000n, 20_000n)
    const restored = new LiquidityPool(token0, token1, 30n, pool.state)

    assert.deepEqual(restored.reserves, [10_000n, 20_000n])
    assert.equal(restored.liquidityOf(alice), 14_142n)

    const result = await pool.removeLiquidity(14_142n, 9_999n, 19_999n)
    assert.deepEqual(result, {
      amount0: 10_000n,
      amount1: 20_000n,
      liquidity: 14_142n
    })
    assert.deepEqual(pool.reserves, [0n, 0n])
    assert.equal(pool.totalLiquidity, 0n)
  })

  it('rejects invalid pairs and missing allowance', async () => {
    assert.throws(() => new LiquidityPool(token0, token0), {
      message: 'pool tokens must differ'
    })
    allowances[token0][alice][poolAddress] = 0n
    await assert.rejects(pool.addLiquidity(10_000n, 10_000n), {
      message: 'amount exceeds allowance'
    })
  })

  it('trades mock WETH and USDC through their real token contract interface', async () => {
    const wethAddress = '0xMockWETH'
    const usdcAddress = '0xMockUSDC'
    global.msg = { sender: alice }
    const weth = new MockToken('Mock Wrapped Ether', 'WETH', 18, 100_000n)
    const usdc = new MockToken('Mock USD Coin', 'USDC', 6, 200_000n)
    const tokens = { [wethAddress]: weth, [usdcAddress]: usdc }
    const contractPool = new LiquidityPool(wethAddress, usdcAddress)

    weth.approve(poolAddress, 100_000n)
    usdc.approve(poolAddress, 200_000n)
    global.msg = {
      sender: alice,
      contract: poolAddress,
      call: async (contract, method, params) => {
        const previousMessage = global.msg
        global.msg = { sender: poolAddress, contract }
        try {
          return await tokens[contract][method](...params)
        } finally {
          global.msg = previousMessage
        }
      }
    }

    await contractPool.addLiquidity(10_000n, 20_000n)

    assert.deepEqual(contractPool.reserves, [10_000n, 20_000n])
    assert.equal(weth.balanceOf(poolAddress), 10_000n)
    assert.equal(usdc.balanceOf(poolAddress), 20_000n)
    assert.equal(weth.allowance(alice, poolAddress), 90_000n)
    assert.equal(usdc.allowance(alice, poolAddress), 180_000n)
  })
})

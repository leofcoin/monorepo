import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import LiquidityPoolFactory from '../exports/liquidity-pool-factory.js'

describe('LiquidityPoolFactory', () => {
  const creator = '0xCreator'
  const token0 = '0xToken0'
  const token1 = '0xToken1'
  const poolAddress = '0xPool'
  let factory
  let pool

  beforeEach(() => {
    pool = { creator, token0, token1, feeBasisPoints: 30n }
    global.msg = {
      sender: creator,
      contract: '0xFactory',
      staticCall: async (target, method) => {
        assert.equal(target, poolAddress)
        return pool[method]
      }
    }
    factory = new LiquidityPoolFactory()
  })

  it('registers one canonical pool per pair', async () => {
    assert.equal(await factory.registerPool(poolAddress), poolAddress)
    assert.equal(factory.poolFor(token0, token1), poolAddress)
    assert.equal(factory.poolFor(token1, token0), poolAddress)
    assert.deepEqual(factory.pools, [poolAddress])
    assert.equal(factory.totalPools, 1n)

    await assert.rejects(factory.registerPool(poolAddress), {
      message: 'pool already registered'
    })
  })

  it('requires the factory owner and accepts either pool token order', async () => {
    global.msg.sender = '0xAttacker'
    await assert.rejects(factory.registerPool(poolAddress), {
      message: 'only the factory owner may register pools'
    })

    global.msg.sender = creator
    pool = { ...pool, token0: token1, token1: token0 }
    assert.equal(await factory.registerPool(poolAddress), poolAddress)
    assert.equal(factory.poolFor(token0, token1), poolAddress)
  })

  it('requires pools to be deployed by the factory owner', async () => {
    pool.creator = '0xDifferentCreator'
    await assert.rejects(factory.registerPool(poolAddress), {
      message: 'factory owner must deploy the pool'
    })
  })

  it('rejects a second pool for the same pair and restores state', async () => {
    await factory.registerPool(poolAddress)
    const restored = new LiquidityPoolFactory(factory.state)
    assert.equal(restored.poolFor(token1, token0), poolAddress)

    const secondPool = '0xSecondPool'
    global.msg.staticCall = async (target, method) => {
      assert.equal(target, secondPool)
      return pool[method]
    }
    await assert.rejects(restored.registerPool(secondPool), {
      message: 'pair already registered'
    })
  })
})

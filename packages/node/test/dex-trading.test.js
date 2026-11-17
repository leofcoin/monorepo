import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addDexLiquidity,
  discoverDexFactories,
  executeSwap,
  formatTokenAmount,
  loadDexPools,
  parseLiquidityUnits, parseTokenAmount,
  quoteSwap,
  removeDexLiquidity
} from '../src/controllers/dex-trading.ts'

const account = 'alice'
const pool = {
  address: 'pool', token0: 'lfc', token1: 'usd', feeBasisPoints: 30n,
  reserve0: 1000n * 10n ** 18n, reserve1: 2000n * 10n ** 6n, totalLiquidity: 1_000_000_000_000n,
  liquidity: 100_000_000_000n,
  token0Info: { address: 'lfc', name: 'Leofcoin', symbol: 'LFC', decimals: 18, balance: 50n * 10n ** 18n },
  token1Info: { address: 'usd', name: 'Test USD', symbol: 'tUSD', decimals: 6, balance: 100n * 10n ** 6n }
}

const values = {
  'factory:pools': ['pool'], 'factory:totalPools': 1n,
  'pool:token0': 'lfc', 'pool:token1': 'usd', 'pool:feeBasisPoints': 30n,
  'pool:reserve0': pool.reserve0, 'pool:reserve1': pool.reserve1,
  'pool:totalLiquidity': pool.totalLiquidity, 'pool:liquidityOf': pool.liquidity, 'pool:getAmountOut': 1_990_000n,
  'lfc:name': 'Leofcoin', 'lfc:symbol': 'LFC', 'lfc:decimals': 18, 'lfc:balanceOf': 50n * 10n ** 18n,
  'usd:name': 'Test USD', 'usd:symbol': 'tUSD', 'usd:decimals': 6, 'usd:balanceOf': 100n * 10n ** 6n,
  'lfc:allowance': 0n
}

function fixture() {
  let nonce = 0
  const sent = []
  const chain = {
    state: { sync: 'synced' }, contracts: Promise.resolve(['not-factory', 'factory']),
    async staticCall(contract, method) {
      const key = `${contract}:${method}`
      if (!(key in values)) throw new Error('method unavailable')
      return values[key]
    },
    async getNonce() { return nonce++ },
    async sendTransaction(transaction) {
      sent.push(transaction)
      return { hash: `hash-${sent.length}`, wait: Promise.resolve() }
    }
  }
  const identity = { signer: async () => ({ sign: async () => new Uint8Array(64) }) }
  return { chain, identity, sent, peernet: { connections: { peer: { connected: true } } } }
}

test('parses token precision without floating point loss', () => {
  assert.equal(parseTokenAmount('1.000001', 6), 1_000_001n)
  assert.equal(formatTokenAmount(1_000_001n, 6), '1.000001')
  assert.throws(() => parseTokenAmount('1.0000001', 6), /at most 6/)
  assert.throws(() => parseTokenAmount('0', 18), /greater than zero/)
  assert.equal(parseLiquidityUnits('123'), 123n)
  assert.throws(() => parseLiquidityUnits('1.5'), /whole number/)
})

test('discovers valid factories and loads typed pool data', async () => {
  const { chain } = fixture()
  assert.deepEqual(await discoverDexFactories(chain), ['factory'])
  const pools = await loadDexPools(chain, 'factory', account)
  assert.equal(pools[0].token0Info.symbol, 'LFC')
  assert.equal(pools[0].token1Info.decimals, 6)
  assert.equal(pools[0].liquidity, pool.liquidity)
})

test('quotes with slippage and confirms approval before swap', async () => {
  const { chain, identity, peernet, sent } = fixture()
  const quote = await quoteSwap(chain, 'factory', pool, 'lfc', '1', 50)
  assert.equal(quote.amountIn, 10n ** 18n)
  assert.equal(quote.minimumAmountOut, 1_980_050n)
  const result = await executeSwap({ chain, identity, peernet, factory: 'factory', pool, account,
    tokenIn: 'lfc', amountIn: quote.amountIn, minimumAmountOut: quote.minimumAmountOut })
  assert.equal(result.approvalHash, 'hash-1')
  assert.equal(result.hash, 'hash-2')
  assert.deepEqual(sent.map(transaction => transaction.method), ['approve', 'swapExactTokensForTokens'])
  assert.deepEqual(sent.map(transaction => transaction.nonce), [1, 2])
})

test('blocks trading while disconnected', async () => {
  const { chain, identity, peernet } = fixture()
  peernet.connections = {}
  await assert.rejects(executeSwap({ chain, identity, peernet, factory: 'factory', pool, account,
    tokenIn: 'lfc', amountIn: 1n, minimumAmountOut: 1n }), /connected and synced/)
})

test('protects liquidity minting and withdrawals with non-zero minimums', async () => {
  const { chain, identity, peernet, sent } = fixture()
  values['lfc:allowance'] = 10n ** 30n
  values['usd:allowance'] = 10n ** 30n
  try {
    await addDexLiquidity({ chain, identity, peernet, factory: 'factory', pool, account, amount0: '1', amount1: '2' })
    assert.equal(sent[0].method, 'addLiquidity')
    assert.ok(sent[0].params[2] > 0n)
    await removeDexLiquidity({ chain, identity, peernet, factory: 'factory', pool, account, liquidity: '10000000000' })
    assert.equal(sent[1].method, 'removeLiquidity')
    assert.ok(sent[1].params[1] > 0n)
    assert.ok(sent[1].params[2] > 0n)
  } finally {
    values['lfc:allowance'] = 0n
    delete values['usd:allowance']
  }
})

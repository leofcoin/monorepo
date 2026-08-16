import assert from 'node:assert/strict'
import test from 'node:test'

import DexClient from '../exports/dex.js'
import { DexClient as RootDexClient } from '../exports/index.js'

assert.equal(RootDexClient, DexClient)

const values = {
  'factory:pools': ['pool'],
  'factory:poolFor': 'pool',
  'pool:token0': 'lfc',
  'pool:token1': 'tusd',
  'pool:feeBasisPoints': '30',
  'pool:reserve0': 1_000_000n,
  'pool:reserve1': '2000000',
  'pool:totalLiquidity': 1_414_213n,
  'pool:liquidityOf': 700n,
  'pool:getAmountOut': 19_743n
}

const calls = []
const sent = []
const transport = {
  async staticCall(contract, method, params) {
    calls.push({ contract, method, params })
    return values[`${contract}:${method}`]
  },
  async getNonce() {
    return 4n
  },
  async sendTransaction(transaction) {
    sent.push(transaction)
    return 'transaction-hash'
  }
}

test('reads factory and pool state with normalized bigint values', async () => {
  const dex = new DexClient(transport, 'factory')

  assert.equal(await dex.poolFor('lfc', 'tusd'), 'pool')
  assert.deepEqual(await dex.pools(), ['pool'])
  assert.deepEqual(await dex.poolState('pool'), {
    address: 'pool',
    token0: 'lfc',
    token1: 'tusd',
    feeBasisPoints: 30n,
    reserve0: 1_000_000n,
    reserve1: 2_000_000n,
    totalLiquidity: 1_414_213n
  })
  assert.equal(await dex.liquidityOf('pool', 'alice'), 700n)
  assert.equal(await dex.quoteExactInput('pool', 'lfc', 10_000n), 19_743n)
  assert.equal(dex.minimumAmountOut(19_743n, 50n), 19_644n)
})

test('builds pool calls with an explicit nonce, timestamp and deadline', async () => {
  const dex = new DexClient(transport, 'factory')
  const options = { nonce: 9, timestamp: 1234 }

  assert.deepEqual(await dex.approve('alice', 'lfc', 'pool', 500n, options), {
    from: 'alice',
    to: 'lfc',
    method: 'approve',
    params: ['pool', 500n],
    nonce: 9,
    timestamp: 1234
  })
  assert.deepEqual(await dex.addLiquidity('alice', 'pool', 500n, 1_000n, 600n, options), {
    from: 'alice',
    to: 'pool',
    method: 'addLiquidity',
    params: [500n, 1_000n, 600n],
    nonce: 9,
    timestamp: 1234
  })
  assert.deepEqual(await dex.swapExactInput('alice', 'pool', 'lfc', 100n, 190n, 'bob', 5000, options), {
    from: 'alice',
    to: 'pool',
    method: 'swapExactTokensForTokens',
    params: ['lfc', 100n, 190n, 'bob', 5000],
    nonce: 9,
    timestamp: 1234
  })
})

test('fetches the next nonce and only submits after explicit signing', async () => {
  const dex = new DexClient(transport, 'factory')
  const transaction = await dex.registerPool('owner', 'pool', { timestamp: 1234 })

  assert.equal(transaction.nonce, 5)
  assert.equal(
    await dex.signAndSend(transaction, (raw) => ({ ...raw, signature: 'signed' })),
    'transaction-hash'
  )
  assert.equal(sent.at(-1).signature, 'signed')
})

test('rejects unsafe amounts, pairs, slippage and unsigned transports', async () => {
  const dex = new DexClient({ staticCall: transport.staticCall }, 'factory')

  await assert.rejects(() => dex.poolFor('lfc', 'lfc'), /must differ/)
  assert.throws(() => dex.approve('alice', 'lfc', 'pool', 0n), /must be positive/)
  assert.throws(() => dex.minimumAmountOut(100n, 10_000n), /below 10000/)
  await assert.rejects(
    () => dex.addLiquidity('alice', 'pool', 1n, 1n),
    /nonce required/
  )
})

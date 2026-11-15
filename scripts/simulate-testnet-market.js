import assert from 'node:assert/strict'
import LiquidityPool from '@leofcoin/contracts/liquidity-pool'
import Leofcoin from '@leofcoin/contracts/native-token'
import MockToken from '@leofcoin/contracts/mock-token'
import { formatUnits } from '@leofcoin/utils'

const usage = 'Usage: node scripts/simulate-testnet-market.js [--seed 1..4294967295] [--rounds 1..365] [--json]'
const args = process.argv.slice(2)
let seed = 42, rounds = 30, json = false
for (let index = 0; index < args.length; index++) {
  const flag = args[index]
  if (flag === '--json') { json = true; continue }
  if (flag !== '--seed' && flag !== '--rounds') throw new Error(usage)
  const raw = args[++index]
  if (!raw || !/^[1-9]\d*$/.test(raw)) throw new Error(usage)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value > (flag === '--seed' ? 0xffffffff : 365)) throw new Error(usage)
  if (flag === '--seed') seed = value
  else rounds = value
}

const UNIT = 10n ** 18n
const provider = 'liquidity-provider'
const merchant = 'merchant'
const investor = 'investor'
const consumers = ['consumer-1', 'consumer-2', 'consumer-3']
const accounts = [provider, merchant, investor, ...consumers]
const poolAddress = 'simulation-pool'
const lfcAddress = 'simulation-lfc'
const eurAddress = 'simulation-teur'
const previousMessage = globalThis.msg
const tokens = {}
let randomState = seed
const random = () => {
  randomState ^= randomState << 13
  randomState ^= randomState >>> 17
  randomState ^= randomState << 5
  return randomState >>> 0
}
const chance = percent => random() % 100 < percent
const randomAmount = (min, range) => BigInt(min + random() % range) * UNIT / 10n
const price = (lfc, eur) => {
  const scaled = eur * 1_000_000n / lfc
  return `${scaled / 1_000_000n}.${String(scaled % 1_000_000n).padStart(6, '0')}`
}

try {
  globalThis.msg = {
    sender: provider,
    contract: poolAddress,
    async call(address, method, params) {
      const token = tokens[address]
      if (!token || !['transfer', 'transferFrom'].includes(method))
        throw new Error('Unsupported simulated token call')
      const previous = globalThis.msg
      globalThis.msg = { sender: poolAddress, contract: address }
      try { return await token[method](...params) }
      finally { globalThis.msg = previous }
    }
  }
  const allocations = [
    { address: provider, amount: 1_000n * UNIT },
    { address: merchant, amount: 100n * UNIT },
    { address: investor, amount: 300n * UNIT },
    ...consumers.map(address => ({ address, amount: 8n * UNIT }))
  ]
  tokens[lfcAddress] = new Leofcoin(1_424n * UNIT, 1_424n * UNIT, allocations)
  tokens[eurAddress] = new MockToken('Simulated Euro', 'tEUR', 18, 300n * UNIT, [
    { address: provider, amount: 100n * UNIT },
    { address: merchant, amount: 10n * UNIT },
    { address: investor, amount: 100n * UNIT },
    ...consumers.map(address => ({ address, amount: 30n * UNIT }))
  ])
  const pool = new LiquidityPool(lfcAddress, eurAddress)
  tokens[lfcAddress].approve(poolAddress, 1_000n * UNIT)
  tokens[eurAddress].approve(poolAddress, 100n * UNIT)
  await pool.addLiquidity(1_000n * UNIT, 100n * UNIT)
  for (const account of accounts.filter(account => account !== provider)) {
    globalThis.msg.sender = account
    tokens[lfcAddress].approve(poolAddress, 1_424n * UNIT)
    tokens[eurAddress].approve(poolAddress, 300n * UNIT)
  }

  const metrics = {
    buys: 0, sells: 0, servicePayments: 0, skippedInsufficient: 0, skippedSlippage: 0,
    inputLfc: 0n, inputTEur: 0n, feeLfc: 0n, feeTEur: 0n, serviceLfc: 0n
  }
  const snapshots = []
  const checkAccounting = () => {
    for (const [address, reserve] of [[lfcAddress, pool.reserve0], [eurAddress, pool.reserve1]]) {
      assert.equal(tokens[address].balanceOf(poolAddress), reserve, 'pool reserve mismatch')
      assert.equal(accounts.reduce((total, account) => total + tokens[address].balanceOf(account), reserve),
        tokens[address].totalSupply, 'simulated token supply changed')
    }
  }
  const snapshot = day => {
    checkAccounting()
    snapshots.push({ day, spotTEurPerLfc: price(pool.reserve0, pool.reserve1),
      poolLfc: formatUnits(pool.reserve0), poolTEur: formatUnits(pool.reserve1) })
  }
  const trade = async (account, token, amount) => {
    if (tokens[token].balanceOf(account) < amount) { metrics.skippedInsufficient++; return }
    const [reserveIn, reserveOut] = token === lfcAddress
      ? [pool.reserve0, pool.reserve1] : [pool.reserve1, pool.reserve0]
    const quote = pool.getAmountOut(token, amount)
    const spotQuote = amount * reserveOut / reserveIn
    if (quote <= 0n || quote * 10_000n < spotQuote * 9_700n) { metrics.skippedSlippage++; return }
    globalThis.msg.sender = account
    assert.equal(await pool.swapExactTokensForTokens(token, amount, quote, account), quote)
    const fee = amount * pool.feeBasisPoints / 10_000n
    if (token === lfcAddress) {
      metrics.sells++; metrics.inputLfc += amount; metrics.feeLfc += fee
    } else {
      metrics.buys++; metrics.inputTEur += amount; metrics.feeTEur += fee
    }
  }

  snapshot(0)
  for (let day = 1; day <= rounds; day++) {
    for (const consumer of consumers) {
      if (tokens[lfcAddress].balanceOf(consumer) < 12n * UNIT && chance(75))
        await trade(consumer, eurAddress, randomAmount(5, 16))
      if (chance(50)) {
        const cost = 2n * UNIT
        if (tokens[lfcAddress].balanceOf(consumer) < cost) metrics.skippedInsufficient++
        else {
          globalThis.msg.sender = consumer
          tokens[lfcAddress].transfer(merchant, cost)
          metrics.servicePayments++; metrics.serviceLfc += cost
        }
      }
    }
    if (chance(65)) await trade(merchant, lfcAddress, randomAmount(30, 71))
    if (chance(55)) {
      const preferredBuy = pool.reserve1 * 10n < pool.reserve0
      const buy = chance(preferredBuy ? 65 : 35)
      await trade(investor, buy ? eurAddress : lfcAddress, buy ? randomAmount(5, 16) : randomAmount(30, 71))
    }
    snapshot(day)
  }

  const report = {
    scope: 'isolated in-memory simulation; no network, real EUR, real demand, consensus or network fees',
    assumptions: 'seeded hypothetical consumers, merchant and investor; consumers top up below 12 LFC; fixed service price; 3% max swap impact; no external market',
    seed, rounds, poolFeeBasisPoints: String(pool.feeBasisPoints),
    metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) =>
      [key, typeof value === 'bigint' ? formatUnits(value) : value])),
    balances: Object.fromEntries(accounts.map(account => [account, {
      LFC: formatUnits(tokens[lfcAddress].balanceOf(account)),
      tEUR: formatUnits(tokens[eurAddress].balanceOf(account))
    }])),
    snapshots
  }
  if (json) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(report.scope)
    console.log(report.assumptions)
    console.log(`Seed: ${seed}; simulated days: ${rounds}; pool fee: ${pool.feeBasisPoints} basis points`)
    console.table(snapshots.filter(item => item.day === 0 || item.day % 5 === 0 || item.day === rounds))
    console.log('Activity:', report.metrics)
    console.table(report.balances)
    console.log('Prices, trade and service demand are simulated assumptions, not evidence of real economic value.')
  }
} finally {
  if (previousMessage === undefined) delete globalThis.msg
  else globalThis.msg = previousMessage
}

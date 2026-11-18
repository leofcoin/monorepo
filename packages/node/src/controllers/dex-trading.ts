import DexClient, { type DexTransaction, type PoolState } from '@leofcoin/endpoint-clients/dex'
import { calculateFee, signTransaction } from '@leofcoin/lib'
import { verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import { formatUnits, parseUnits } from '@leofcoin/utils'
import { networkStatus } from './transfer.js'

export type TokenInfo = {
  address: string
  name: string
  symbol: string
  decimals: number
  balance: bigint
}

export type DexPool = PoolState & {
  token0Info: TokenInfo
  token1Info: TokenInfo
  liquidity: bigint
}

export type ChainLike = {
  state?: { sync?: string }
  nativeToken?: string
  balanceOf?(account: string): Promise<bigint>
  contracts?: Promise<unknown> | unknown
  getChainIdentity?(): Promise<unknown>
  staticCall(contract: string, method: string, params?: unknown[]): Promise<unknown>
  getNonce(address: string): Promise<number | string | bigint>
  sendTransaction(transaction: unknown): Promise<unknown>
}

type IdentityLike = { signer(address: string): Promise<{ sign(hash: Uint8Array): Promise<Uint8Array> | Uint8Array }> }
type Submission = {
  check?: () => void
  onPending?: (method: string, hash: string) => void
  nativeSpend?: bigint
}

const wholeNumber = (value: unknown, fallback = 18) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 && number <= 18 ? number : fallback
}

export function parseTokenAmount(value: string, decimals: number): bigint {
  value = String(value ?? '').trim()
  decimals = wholeNumber(decimals)
  const pattern = decimals
    ? new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${decimals}})?$`)
    : /^(?:0|[1-9]\d*)$/
  if (!pattern.test(value))
    throw new Error(`Enter a positive amount with at most ${decimals} decimal places.`)
  const result = parseUnits(value, decimals)
  if (result <= 0n) throw new Error('Amount must be greater than zero.')
  return result
}

export function formatTokenAmount(value: bigint, decimals: number, maximumFractionDigits = 6): string {
  const formatted = formatUnits(value, wholeNumber(decimals))
  const [whole, fraction = ''] = formatted.split('.')
  const visible = fraction.slice(0, maximumFractionDigits).replace(/0+$/, '')
  return visible ? `${whole}.${visible}` : whole
}

export function parseLiquidityUnits(value: string): bigint {
  value = String(value ?? '').trim()
  if (!/^[1-9]\d*$/.test(value)) throw new Error('Enter a positive whole number of liquidity units.')
  return BigInt(value)
}

export function createDexClient(chain: ChainLike, factory: string) {
  return new DexClient({
    staticCall: (contract, method, params = []) => chain.staticCall(contract, method, params),
    getNonce: address => chain.getNonce(address),
    sendTransaction: transaction => chain.sendTransaction(transaction)
  }, factory)
}

export async function validateFactory(chain: ChainLike, factory: string): Promise<string[]> {
  factory = String(factory || '').trim()
  if (!factory) throw new Error('Enter a DEX factory contract address.')
  const pools = await createDexClient(chain, factory).pools()
  if (pools.some(pool => !pool)) throw new Error('The factory returned an invalid pool address.')
  return pools
}

/** Prefer the immutable chain identity to a scanned or locally saved registry. */
export async function genesisDexFactory(chain: ChainLike): Promise<string | undefined> {
  if (typeof chain.getChainIdentity !== 'function') return undefined
  const identity = await verifyChainIdentity(await chain.getChainIdentity())
  const factory = identity.genesisContracts.dexFactory
  if (factory) await validateFactory(chain, factory)
  return factory
}

export async function discoverDexFactories(chain: ChainLike, limit = 250): Promise<string[]> {
  const registered = await Promise.resolve(chain.contracts)
  if (!Array.isArray(registered)) throw new Error('The registered contract list is unavailable.')
  const candidates = registered.slice(-limit).map(String)
  const factories: string[] = []
  for (let offset = 0; offset < candidates.length; offset += 12) {
    const batch = candidates.slice(offset, offset + 12)
    const results = await Promise.all(batch.map(async candidate => {
      try {
        const pools = await validateFactory(chain, candidate)
        const total = BigInt(await chain.staticCall(candidate, 'totalPools', []) as bigint | string | number)
        return total === BigInt(pools.length) ? candidate : undefined
      } catch { return undefined }
    }))
    factories.push(...results.filter((candidate): candidate is string => Boolean(candidate)))
  }
  return factories
}

async function tokenInfo(chain: ChainLike, address: string, account: string): Promise<TokenInfo> {
  const read = (method: string, params: unknown[] = []) => chain.staticCall(address, method, params)
  const [name, symbol, decimals, balance] = await Promise.all([
    read('name').catch(() => 'Unknown token'),
    read('symbol').catch(() => `${address.slice(0, 6)}…`),
    read('decimals').catch(() => 18),
    read('balanceOf', [account])
  ])
  return {
    address,
    name: String(name || 'Unknown token'),
    symbol: String(symbol || `${address.slice(0, 6)}…`),
    decimals: wholeNumber(decimals),
    balance: BigInt(balance as bigint | string | number)
  }
}

export async function loadDexPools(chain: ChainLike, factory: string, account: string): Promise<DexPool[]> {
  if (!account) throw new Error('Unlock your wallet and select an account.')
  const dex = createDexClient(chain, factory)
  const pools = await dex.pools()
  const loadPool = async (address: string) => {
    const state = await dex.poolState(address)
    const [token0Info, token1Info, liquidity] = await Promise.all([
      tokenInfo(chain, state.token0, account),
      tokenInfo(chain, state.token1, account),
      dex.liquidityOf(address, account)
    ])
    return { ...state, token0Info, token1Info, liquidity }
  }
  const results: DexPool[] = []
  // Keep concurrent reads under the local VM's bounded query queue.
  for (let index = 0; index < pools.length; index += 2)
    results.push(...await Promise.all(pools.slice(index, index + 2).map(loadPool)))
  return results
}

async function sendAndConfirm(chain: ChainLike, identity: IdentityLike, account: string, raw: DexTransaction, submission: Submission) {
  submission.check?.()
  const signer = await identity.signer(account)
  submission.check?.()
  const signed = await signTransaction(raw as any, signer)
  if (chain.balanceOf) {
    const [fee, balance] = await Promise.all([calculateFee(signed), chain.balanceOf(account)])
    if (BigInt(balance) < BigInt(fee) + (submission.nativeSpend ?? 0n))
      throw new Error('Your LFC balance does not cover the amount and network fee.')
  }
  submission.check?.()
  const pending = await chain.sendTransaction(signed)
  if (!pending || typeof pending !== 'object' || !('hash' in pending) || !('wait' in pending))
    throw new Error('The node did not return a transaction confirmation handle.')
  const confirmation = pending as { hash: string; wait: Promise<unknown> }
  if (!confirmation.hash || !confirmation.wait || typeof confirmation.wait.then !== 'function')
    throw new Error('The node did not return a transaction confirmation handle.')
  submission.onPending?.(raw.method, confirmation.hash)
  await confirmation.wait
  return confirmation.hash
}

function assertTradingReady(chain: ChainLike, peernet: unknown, account: string) {
  if (!account) throw new Error('Unlock your wallet and select an account.')
  if (!networkStatus(chain, peernet).ready)
    throw new Error('Wait until your node is connected and synced before trading.')
}

async function approveIfNeeded(options: {
  chain: ChainLike
  identity: IdentityLike
  dex: DexClient
  account: string
  token: string
  pool: string
  amount: bigint
} & Submission) {
  const allowance = BigInt(await options.chain.staticCall(options.token, 'allowance', [options.account, options.pool]) as bigint | string | number)
  if (allowance >= options.amount) return undefined
  const raw = await options.dex.approve(options.account, options.token, options.pool, options.amount)
  return sendAndConfirm(options.chain, options.identity, options.account, raw, options)
}

export async function quoteSwap(chain: ChainLike, factory: string, pool: DexPool, tokenIn: string, input: string, slippageBasisPoints: number) {
  const info = tokenIn === pool.token0 ? pool.token0Info : tokenIn === pool.token1 ? pool.token1Info : undefined
  const output = tokenIn === pool.token0 ? pool.token1Info : pool.token0Info
  if (!info) throw new Error('Select an input token from this pool.')
  if (!Number.isSafeInteger(slippageBasisPoints) || slippageBasisPoints < 0 || slippageBasisPoints >= 10_000)
    throw new Error('Slippage must be between 0 and 99.99%.')
  const dex = createDexClient(chain, factory)
  const amountIn = parseTokenAmount(input, info.decimals)
  const amountOut = await dex.quoteExactInput(pool.address, tokenIn, amountIn)
  if (amountOut <= 0n) throw new Error('This amount is too small to swap.')
  const minimumAmountOut = dex.minimumAmountOut(amountOut, BigInt(slippageBasisPoints))
  return {
    amountIn,
    amountOut,
    minimumAmountOut: minimumAmountOut || 1n,
    input: info,
    output
  }
}

export async function executeSwap(options: {
  chain: ChainLike
  peernet: unknown
  identity: IdentityLike
  factory: string
  pool: DexPool
  account: string
  tokenIn: string
  amountIn: bigint
  minimumAmountOut: bigint
  deadline?: number
} & Submission) {
  assertTradingReady(options.chain, options.peernet, options.account)
  if (options.minimumAmountOut <= 0n) throw new Error('A positive minimum received is required.')
  const deadline = options.deadline ?? Date.now() + 20 * 60 * 1000
  const check = () => {
    options.check?.()
    if (Date.now() >= deadline) throw new Error('The quote expired. Review a new quote before swapping.')
  }
  check()
  const dex = createDexClient(options.chain, options.factory)
  if (options.tokenIn !== options.pool.token0 && options.tokenIn !== options.pool.token1)
    throw new Error('Select an input token from this pool.')
  const [currentOutput, tokenBalance] = await Promise.all([
    dex.quoteExactInput(options.pool.address, options.tokenIn, options.amountIn),
    options.chain.staticCall(options.tokenIn, 'balanceOf', [options.account])
  ])
  if (BigInt(tokenBalance as bigint | string | number) < options.amountIn)
    throw new Error('Your token balance does not cover the swap amount.')
  if (currentOutput < options.minimumAmountOut)
    throw new Error('The pool price changed. Review a new quote before swapping.')
  const nativeSpend = options.tokenIn === options.chain.nativeToken ? options.amountIn : 0n
  const submission = { ...options, check, nativeSpend }
  const approvalHash = await approveIfNeeded({ ...submission, dex, token: options.tokenIn, pool: options.pool.address, amount: options.amountIn })
  check()
  const raw = await dex.swapExactInput(
    options.account, options.pool.address, options.tokenIn, options.amountIn,
    options.minimumAmountOut, options.account, deadline
  )
  return { approvalHash, hash: await sendAndConfirm(options.chain, options.identity, options.account, raw, submission) }
}

export async function addDexLiquidity(options: {
  chain: ChainLike
  peernet: unknown
  identity: IdentityLike
  factory: string
  pool: DexPool
  account: string
  amount0: string
  amount1: string
  slippageBasisPoints?: number
} & Submission) {
  assertTradingReady(options.chain, options.peernet, options.account)
  const amount0 = parseTokenAmount(options.amount0, options.pool.token0Info.decimals)
  const amount1 = parseTokenAmount(options.amount1, options.pool.token1Info.decimals)
  const expectedLiquidity = options.pool.totalLiquidity === 0n
    ? squareRoot(amount0 * amount1)
    : minBigInt(
        amount0 * options.pool.totalLiquidity / options.pool.reserve0,
        amount1 * options.pool.totalLiquidity / options.pool.reserve1
      )
  const slippage = BigInt(options.slippageBasisPoints ?? 50)
  if (slippage < 0n || slippage >= 10_000n) throw new Error('Liquidity slippage must be below 100%.')
  const minimumLiquidity = expectedLiquidity * (10_000n - slippage) / 10_000n
  if (minimumLiquidity <= 0n) throw new Error('The liquidity position would round to zero.')
  const dex = createDexClient(options.chain, options.factory)
  const approvals = []
  approvals.push(await approveIfNeeded({ ...options, dex, token: options.pool.token0, pool: options.pool.address, amount: amount0 }))
  approvals.push(await approveIfNeeded({ ...options, dex, token: options.pool.token1, pool: options.pool.address, amount: amount1 }))
  const raw = await dex.addLiquidity(options.account, options.pool.address, amount0, amount1, minimumLiquidity)
  return { approvals: approvals.filter(Boolean), hash: await sendAndConfirm(options.chain, options.identity, options.account, raw, options) }
}

export async function removeDexLiquidity(options: {
  chain: ChainLike
  peernet: unknown
  identity: IdentityLike
  factory: string
  pool: DexPool
  account: string
  liquidity: string
  slippageBasisPoints?: number
} & Submission) {
  assertTradingReady(options.chain, options.peernet, options.account)
  const liquidity = parseLiquidityUnits(options.liquidity)
  if (liquidity > options.pool.liquidity) throw new Error('You do not have that much pool liquidity.')
  if (options.pool.totalLiquidity <= 0n) throw new Error('The pool has no liquidity.')
  const slippage = BigInt(options.slippageBasisPoints ?? 50)
  if (slippage < 0n || slippage >= 10_000n) throw new Error('Liquidity slippage must be below 100%.')
  const expected0 = liquidity * options.pool.reserve0 / options.pool.totalLiquidity
  const expected1 = liquidity * options.pool.reserve1 / options.pool.totalLiquidity
  const minimum0 = expected0 * (10_000n - slippage) / 10_000n
  const minimum1 = expected1 * (10_000n - slippage) / 10_000n
  const dex = createDexClient(options.chain, options.factory)
  const raw = await dex.removeLiquidity(options.account, options.pool.address, liquidity, minimum0, minimum1, options.account)
  return { hash: await sendAndConfirm(options.chain, options.identity, options.account, raw, options) }
}

const minBigInt = (left: bigint, right: bigint) => left < right ? left : right

const squareRoot = (value: bigint): bigint => {
  if (value < 0n) throw new Error('Cannot calculate liquidity from a negative amount.')
  if (value < 2n) return value
  let current = value
  let next = (current + value / current) / 2n
  while (next < current) {
    current = next
    next = (current + value / current) / 2n
  }
  return current
}

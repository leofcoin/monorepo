export type DexTransaction = {
  from: string
  to: string
  method: string
  params: unknown[]
  nonce: number
  timestamp: number
}

export type DexTransport = {
  staticCall: (contract: string, method: string, params?: unknown[]) => Promise<unknown>
  getNonce?: (address: string) => Promise<number | string | bigint>
  sendTransaction?: (transaction: unknown) => Promise<unknown>
}

export type DexSigner = (
  transaction: DexTransaction
) => Promise<unknown> | unknown

export type TransactionOptions = {
  nonce?: number
  timestamp?: number
}

export type PoolState = {
  address: string
  token0: string
  token1: string
  feeBasisPoints: bigint
  reserve0: bigint
  reserve1: bigint
  totalLiquidity: bigint
}

const BASIS_POINTS = 10_000n

const address = (value: string, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} address required`)
  return value
}

const amount = (value: bigint | number | string, label: string, allowZero = false): bigint => {
  const result = BigInt(value)
  if (allowZero ? result < 0n : result <= 0n)
    throw new Error(`${label} must be ${allowZero ? 'non-negative' : 'positive'}`)
  return result
}

const safeInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`)
  return value
}

export default class DexClient {
  readonly transport: DexTransport
  readonly factory: string

  constructor(transport: DexTransport, factory: string) {
    if (!transport || typeof transport.staticCall !== 'function')
      throw new Error('DEX transport with staticCall required')
    this.transport = transport
    this.factory = address(factory, 'factory')
  }

  async poolFor(tokenA: string, tokenB: string): Promise<string | undefined> {
    tokenA = address(tokenA, 'token A')
    tokenB = address(tokenB, 'token B')
    if (tokenA === tokenB) throw new Error('pool tokens must differ')
    const pool = await this.transport.staticCall(this.factory, 'poolFor', [tokenA, tokenB])
    return pool === undefined || pool === null || pool === '' ? undefined : String(pool)
  }

  async pools(): Promise<string[]> {
    const pools = await this.transport.staticCall(this.factory, 'pools', [])
    if (!Array.isArray(pools)) throw new Error('factory returned an invalid pool list')
    return pools.map(String)
  }

  async poolState(pool: string): Promise<PoolState> {
    pool = address(pool, 'pool')
    const [token0, token1, feeBasisPoints, reserve0, reserve1, totalLiquidity] = await Promise.all([
      this.transport.staticCall(pool, 'token0', []),
      this.transport.staticCall(pool, 'token1', []),
      this.transport.staticCall(pool, 'feeBasisPoints', []),
      this.transport.staticCall(pool, 'reserve0', []),
      this.transport.staticCall(pool, 'reserve1', []),
      this.transport.staticCall(pool, 'totalLiquidity', [])
    ])
    return {
      address: pool,
      token0: address(String(token0 ?? ''), 'token 0'),
      token1: address(String(token1 ?? ''), 'token 1'),
      feeBasisPoints: BigInt(feeBasisPoints as bigint | number | string),
      reserve0: BigInt(reserve0 as bigint | number | string),
      reserve1: BigInt(reserve1 as bigint | number | string),
      totalLiquidity: BigInt(totalLiquidity as bigint | number | string)
    }
  }

  async liquidityOf(pool: string, provider: string): Promise<bigint> {
    pool = address(pool, 'pool')
    provider = address(provider, 'provider')
    return BigInt(
      (await this.transport.staticCall(pool, 'liquidityOf', [provider])) as bigint | number | string
    )
  }

  async quoteExactInput(
    pool: string,
    tokenIn: string,
    amountIn: bigint | number | string
  ): Promise<bigint> {
    pool = address(pool, 'pool')
    tokenIn = address(tokenIn, 'input token')
    const input = amount(amountIn, 'input amount')
    return BigInt(
      (await this.transport.staticCall(pool, 'getAmountOut', [tokenIn, input])) as
        | bigint
        | number
        | string
    )
  }

  minimumAmountOut(quote: bigint | number | string, slippageBasisPoints: bigint | number | string): bigint {
    const output = amount(quote, 'quote')
    const slippage = amount(slippageBasisPoints, 'slippage', true)
    if (slippage >= BASIS_POINTS) throw new Error('slippage must be below 10000 basis points')
    return (output * (BASIS_POINTS - slippage)) / BASIS_POINTS
  }

  approve(
    from: string,
    token: string,
    pool: string,
    value: bigint | number | string,
    options: TransactionOptions = {}
  ): Promise<DexTransaction> {
    return this.#transaction(from, token, 'approve', [address(pool, 'pool'), amount(value, 'approval amount')], options)
  }

  addLiquidity(
    from: string,
    pool: string,
    amount0Desired: bigint | number | string,
    amount1Desired: bigint | number | string,
    minimumLiquidity: bigint | number | string = 0n,
    options: TransactionOptions = {}
  ): Promise<DexTransaction> {
    return this.#transaction(
      from,
      pool,
      'addLiquidity',
      [
        amount(amount0Desired, 'token 0 amount'),
        amount(amount1Desired, 'token 1 amount'),
        amount(minimumLiquidity, 'minimum liquidity', true)
      ],
      options
    )
  }

  removeLiquidity(
    from: string,
    pool: string,
    liquidity: bigint | number | string,
    minimumAmount0: bigint | number | string = 0n,
    minimumAmount1: bigint | number | string = 0n,
    receiver = from,
    options: TransactionOptions = {}
  ): Promise<DexTransaction> {
    return this.#transaction(
      from,
      pool,
      'removeLiquidity',
      [
        amount(liquidity, 'liquidity'),
        amount(minimumAmount0, 'minimum token 0 amount', true),
        amount(minimumAmount1, 'minimum token 1 amount', true),
        address(receiver, 'receiver')
      ],
      options
    )
  }

  swapExactInput(
    from: string,
    pool: string,
    tokenIn: string,
    amountIn: bigint | number | string,
    minimumAmountOut: bigint | number | string,
    receiver = from,
    deadline = Date.now() + 20 * 60 * 1000,
    options: TransactionOptions = {}
  ): Promise<DexTransaction> {
    return this.#transaction(
      from,
      pool,
      'swapExactTokensForTokens',
      [
        address(tokenIn, 'input token'),
        amount(amountIn, 'input amount'),
        amount(minimumAmountOut, 'minimum output amount', true),
        address(receiver, 'receiver'),
        safeInteger(deadline, 'deadline')
      ],
      options
    )
  }

  registerPool(
    from: string,
    pool: string,
    options: TransactionOptions = {}
  ): Promise<DexTransaction> {
    return this.#transaction(from, this.factory, 'registerPool', [address(pool, 'pool')], options)
  }

  async signAndSend(transaction: DexTransaction, signer: DexSigner): Promise<unknown> {
    if (typeof signer !== 'function') throw new Error('transaction signer required')
    if (typeof this.transport.sendTransaction !== 'function')
      throw new Error('DEX transport does not support sendTransaction')
    const signed = await signer(transaction)
    return this.transport.sendTransaction(signed)
  }

  async #transaction(
    from: string,
    to: string,
    method: string,
    params: unknown[],
    options: TransactionOptions
  ): Promise<DexTransaction> {
    from = address(from, 'sender')
    to = address(to, 'target')
    let nonce = options.nonce
    if (nonce === undefined) {
      if (typeof this.transport.getNonce !== 'function')
        throw new Error('nonce required when transport has no getNonce')
      nonce = Number(await this.transport.getNonce(from)) + 1
    }
    return {
      from,
      to,
      method,
      params,
      nonce: safeInteger(nonce, 'nonce'),
      timestamp: safeInteger(options.timestamp ?? Date.now(), 'timestamp')
    }
  }
}

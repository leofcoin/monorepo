import Meta, { MetaState } from '@leofcoin/standards/meta.js'

export interface LiquidityPoolState extends MetaState {
  token0: address
  token1: address
  feeBasisPoints: bigint
  reserve0: bigint
  reserve1: bigint
  totalLiquidity: bigint
  liquidity: { [provider: address]: bigint }
}

const BASIS_POINTS = 10_000n

const squareRoot = (value: bigint): bigint => {
  if (value < 0n) throw new Error('cannot calculate square root of a negative value')
  if (value < 2n) return value

  let current = value
  let next = (current + value / current) / 2n
  while (next < current) {
    current = next
    next = (current + value / current) / 2n
  }
  return current
}

export default class LiquidityPool extends Meta {
  #token0: address
  #token1: address
  #feeBasisPoints: bigint
  #reserve0 = 0n
  #reserve1 = 0n
  #totalLiquidity = 0n
  #liquidity: { [provider: address]: bigint } = {}
  #locked = false

  constructor(
    token0: address,
    token1: address,
    feeBasisPoints: bigint = 30n,
    state?: LiquidityPoolState
  ) {
    if (!token0 || !token1) throw new Error('token address undefined')
    if (token0 === token1) throw new Error('pool tokens must differ')
    super(state)
    this.#token0 = token0
    this.#token1 = token1
    this.#feeBasisPoints = BigInt(state?.feeBasisPoints ?? feeBasisPoints)
    if (this.#feeBasisPoints < 0n || this.#feeBasisPoints >= BASIS_POINTS)
      throw new Error('invalid fee')

    if (state) {
      if (state.token0 !== token0 || state.token1 !== token1)
        throw new Error('pool state token mismatch')
      this.#reserve0 = BigInt(state.reserve0)
      this.#reserve1 = BigInt(state.reserve1)
      this.#totalLiquidity = BigInt(state.totalLiquidity)
      this.#liquidity = Object.fromEntries(
        Object.entries(state.liquidity).map(([provider, amount]) => [provider, BigInt(amount)])
      )
    }
  }

  get token0() {
    return this.#token0
  }

  get token1() {
    return this.#token1
  }

  get feeBasisPoints() {
    return this.#feeBasisPoints
  }

  get reserve0() {
    return this.#reserve0
  }

  get reserve1() {
    return this.#reserve1
  }

  get reserves() {
    return [this.#reserve0, this.#reserve1]
  }

  get totalLiquidity() {
    return this.#totalLiquidity
  }

  get state(): LiquidityPoolState {
    return {
      ...(super.state as MetaState),
      token0: this.#token0,
      token1: this.#token1,
      feeBasisPoints: this.#feeBasisPoints,
      reserve0: this.#reserve0,
      reserve1: this.#reserve1,
      totalLiquidity: this.#totalLiquidity,
      liquidity: { ...this.#liquidity }
    }
  }

  liquidityOf(provider: address): bigint {
    return this.#liquidity[provider] ?? 0n
  }

  getAmountOut(tokenIn: address, amountIn: bigint): bigint {
    amountIn = BigInt(amountIn)
    if (amountIn <= 0n) throw new Error('input amount must be positive')

    let reserveIn: bigint
    let reserveOut: bigint
    if (tokenIn === this.#token0) {
      reserveIn = this.#reserve0
      reserveOut = this.#reserve1
    } else if (tokenIn === this.#token1) {
      reserveIn = this.#reserve1
      reserveOut = this.#reserve0
    } else {
      throw new Error('token not in pool')
    }
    if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('insufficient liquidity')

    const amountInWithFee = amountIn * (BASIS_POINTS - this.#feeBasisPoints)
    return (amountInWithFee * reserveOut) / (reserveIn * BASIS_POINTS + amountInWithFee)
  }

  async addLiquidity(
    amount0Desired: bigint,
    amount1Desired: bigint,
    minimumLiquidity: bigint = 0n
  ) {
    return this.#withLock(async () => {
      amount0Desired = BigInt(amount0Desired)
      amount1Desired = BigInt(amount1Desired)
      minimumLiquidity = BigInt(minimumLiquidity)
      if (amount0Desired <= 0n || amount1Desired <= 0n)
        throw new Error('liquidity amounts must be positive')
      if (minimumLiquidity < 0n) throw new Error('minimum liquidity cannot be negative')

      let amount0 = amount0Desired
      let amount1 = amount1Desired
      let minted: bigint
      if (this.#totalLiquidity === 0n) {
        minted = squareRoot(amount0 * amount1)
      } else {
        const amount1ForAmount0 = (amount0Desired * this.#reserve1) / this.#reserve0
        if (amount1ForAmount0 <= amount1Desired) {
          amount1 = amount1ForAmount0
        } else {
          amount0 = (amount1Desired * this.#reserve0) / this.#reserve1
        }
        minted = (amount0 * this.#totalLiquidity) / this.#reserve0
      }

      if (amount0 <= 0n || amount1 <= 0n || minted <= 0n)
        throw new Error('liquidity amount rounds to zero')
      if (minted < minimumLiquidity) throw new Error('minimum liquidity not met')

      const provider = msg.sender
      this.#reserve0 += amount0
      this.#reserve1 += amount1
      this.#totalLiquidity += minted
      this.#liquidity[provider] = this.liquidityOf(provider) + minted

      await this.#pull(this.#token0, provider, amount0)
      await this.#pull(this.#token1, provider, amount1)
      return { amount0, amount1, liquidity: minted }
    })
  }

  async removeLiquidity(
    liquidity: bigint,
    minimumAmount0: bigint = 0n,
    minimumAmount1: bigint = 0n,
    receiver: address = msg.sender
  ) {
    return this.#withLock(async () => {
      liquidity = BigInt(liquidity)
      minimumAmount0 = BigInt(minimumAmount0)
      minimumAmount1 = BigInt(minimumAmount1)
      if (!receiver) throw new Error('receiver undefined')
      if (liquidity <= 0n) throw new Error('liquidity must be positive')
      if (this.liquidityOf(msg.sender) < liquidity)
        throw new Error('insufficient liquidity balance')

      const amount0 = (liquidity * this.#reserve0) / this.#totalLiquidity
      const amount1 = (liquidity * this.#reserve1) / this.#totalLiquidity
      if (amount0 <= 0n || amount1 <= 0n) throw new Error('withdrawal amount rounds to zero')
      if (amount0 < minimumAmount0 || amount1 < minimumAmount1)
        throw new Error('minimum withdrawal amount not met')

      this.#liquidity[msg.sender] -= liquidity
      this.#totalLiquidity -= liquidity
      this.#reserve0 -= amount0
      this.#reserve1 -= amount1

      await this.#push(this.#token0, receiver, amount0)
      await this.#push(this.#token1, receiver, amount1)
      return { amount0, amount1, liquidity }
    })
  }

  async swapExactTokensForTokens(
    tokenIn: address,
    amountIn: bigint,
    minimumAmountOut: bigint,
    receiver: address = msg.sender,
    deadline: number = Number.MAX_SAFE_INTEGER
  ) {
    return this.#withLock(async () => {
      amountIn = BigInt(amountIn)
      minimumAmountOut = BigInt(minimumAmountOut)
      if (!receiver) throw new Error('receiver undefined')
      if (!Number.isSafeInteger(deadline) || deadline < Date.now()) throw new Error('swap expired')

      const amountOut = this.getAmountOut(tokenIn, amountIn)
      if (amountOut <= 0n) throw new Error('output amount rounds to zero')
      if (amountOut < minimumAmountOut) throw new Error('minimum output amount not met')

      const sender = msg.sender
      if (tokenIn === this.#token0) {
        this.#reserve0 += amountIn
        this.#reserve1 -= amountOut
        await this.#pull(this.#token0, sender, amountIn)
        await this.#push(this.#token1, receiver, amountOut)
      } else if (tokenIn === this.#token1) {
        this.#reserve1 += amountIn
        this.#reserve0 -= amountOut
        await this.#pull(this.#token1, sender, amountIn)
        await this.#push(this.#token0, receiver, amountOut)
      } else {
        throw new Error('token not in pool')
      }
      return amountOut
    })
  }

  async #pull(token: address, owner: address, amount: bigint) {
    return msg.call(token, 'transferFrom', [owner, msg.contract, amount])
  }

  async #push(token: address, receiver: address, amount: bigint) {
    return msg.call(token, 'transfer', [receiver, amount])
  }

  async #withLock<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#locked) throw new Error('reentrant call')
    this.#locked = true
    try {
      return await operation()
    } finally {
      this.#locked = false
    }
  }
}

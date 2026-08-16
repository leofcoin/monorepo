import Meta, { MetaState } from '@leofcoin/standards/meta.js'

export interface LiquidityPoolFactoryState extends MetaState {
  pools: address[]
  poolsByToken: { [token0: address]: { [token1: address]: address } }
}

const canonicalPair = (tokenA: address, tokenB: address): [address, address] => {
  if (!tokenA || !tokenB) throw new Error('token address undefined')
  if (tokenA === tokenB) throw new Error('pool tokens must differ')
  return [tokenA, tokenB].sort((left, right) => left.localeCompare(right)) as [address, address]
}

export default class LiquidityPoolFactory extends Meta {
  #pools: address[] = []
  #poolsByToken: { [token0: address]: { [token1: address]: address } } = {}

  constructor(state?: LiquidityPoolFactoryState) {
    super(state)
    if (state) {
      this.#pools = [...state.pools]
      this.#poolsByToken = Object.fromEntries(
        Object.entries(state.poolsByToken).map(([token0, pools]) => [token0, { ...pools }])
      )
    }
  }

  get state(): LiquidityPoolFactoryState {
    return {
      ...(super.state as MetaState),
      pools: [...this.#pools],
      poolsByToken: Object.fromEntries(
        Object.entries(this.#poolsByToken).map(([token0, pools]) => [token0, { ...pools }])
      )
    }
  }

  get pools() {
    return [...this.#pools]
  }

  get totalPools() {
    return BigInt(this.#pools.length)
  }

  poolFor(tokenA: address, tokenB: address): address | undefined {
    const [token0, token1] = canonicalPair(tokenA, tokenB)
    return this.#poolsByToken[token0]?.[token1]
  }

  async registerPool(pool: address): Promise<address> {
    if (!pool) throw new Error('pool address undefined')
    if (this.#pools.includes(pool)) throw new Error('pool already registered')
    if (msg.sender !== this.creator) throw new Error('only the factory owner may register pools')

    const creator = (await msg.staticCall(pool, 'creator')) as address
    if (creator !== msg.sender) throw new Error('factory owner must deploy the pool')

    const poolToken0 = (await msg.staticCall(pool, 'token0')) as address
    const poolToken1 = (await msg.staticCall(pool, 'token1')) as address
    const [token0, token1] = canonicalPair(poolToken0, poolToken1)

    const fee = BigInt(await msg.staticCall(pool, 'feeBasisPoints'))
    if (fee < 0n || fee >= 10_000n) throw new Error('invalid pool fee')
    if (this.#poolsByToken[token0]?.[token1]) throw new Error('pair already registered')

    if (!this.#poolsByToken[token0]) this.#poolsByToken[token0] = {}
    this.#poolsByToken[token0][token1] = pool
    this.#pools.push(pool)
    return pool
  }
}

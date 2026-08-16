import Token, { TokenState } from '@leofcoin/standards/token.js'

export interface MockTokenAllocation {
  address: address
  amount: bigint | string
}

export interface MockTokenState extends TokenState {
  name: string
  symbol: string
  decimals: number
}

const validateMetadata = (name: string, symbol: string, decimals: number) => {
  if (!name?.trim()) throw new Error('token name is required')
  if (!symbol?.trim()) throw new Error('token symbol is required')
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error('token decimals must be an integer between 0 and 18')
}

const initialState = (
  name: string,
  symbol: string,
  decimals: number,
  initialSupply: bigint,
  allocations: MockTokenAllocation[]
): MockTokenState => {
  initialSupply = BigInt(initialSupply)
  if (initialSupply <= 0n) throw new Error('initial supply must be positive')

  const effectiveAllocations = allocations.length > 0 ? allocations : [{ address: msg.sender, amount: initialSupply }]
  const balances: Record<address, bigint> = {}
  let allocated = 0n

  for (const allocation of [...effectiveAllocations].sort((left, right) => left.address.localeCompare(right.address))) {
    if (!allocation.address || balances[allocation.address] !== undefined)
      throw new Error('invalid or duplicate allocation address')
    const amount = BigInt(allocation.amount)
    if (amount <= 0n) throw new Error('allocation amount must be positive')
    balances[allocation.address] = amount
    allocated += amount
  }

  if (allocated !== initialSupply) {
    throw new Error(`allocations must equal initial supply: expected ${initialSupply}, got ${allocated}`)
  }

  return {
    name,
    symbol,
    decimals,
    creator: msg.sender,
    createdAt: BigInt(Date.now()),
    roles: {
      OWNER: [msg.sender],
      MINT: [msg.sender],
      BURN: [msg.sender]
    },
    holders: BigInt(Object.keys(balances).length),
    balances,
    approvals: {},
    totalSupply: initialSupply
  }
}

/**
 * Development-only fungible asset used to test generic token and DEX behavior.
 * A deployment of this contract never represents or escrows the external asset
 * whose name or symbol it mimics.
 */
export default class MockToken extends Token {
  #tokenName: string
  #tokenSymbol: string
  #tokenDecimals: number

  constructor(
    name: string,
    symbol: string,
    decimals: number,
    initialSupply: bigint,
    allocations: MockTokenAllocation[] = [],
    restoredState?: MockTokenState
  ) {
    validateMetadata(name, symbol, decimals)
    const state = restoredState || initialState(name, symbol, decimals, initialSupply, allocations)
    if (state.name !== name || state.symbol !== symbol || state.decimals !== decimals)
      throw new Error('restored token metadata mismatch')
    super(name, symbol, decimals, state)
    this.#tokenName = name
    this.#tokenSymbol = symbol
    this.#tokenDecimals = decimals
  }

  get name() {
    return this.#tokenName
  }

  get symbol() {
    return this.#tokenSymbol
  }

  get decimals() {
    return this.#tokenDecimals
  }

  get state(): MockTokenState {
    return {
      ...super.state,
      name: this.#tokenName,
      symbol: this.#tokenSymbol,
      decimals: this.#tokenDecimals
    } as MockTokenState
  }
}

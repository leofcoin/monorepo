import Token, { TokenState } from '@leofcoin/standards/token.js'

interface GenesisAllocation {
  address: address
  amount: bigint | string
}
interface LeofcoinState extends TokenState {
  initialSupply: bigint
  targetSupply: bigint
}

export const MONETARY_POLICY_AUTHORITY = 'leofcoin:protocol:monetary-policy:v1'

const genesisState = (initialSupply: bigint, allocations: GenesisAllocation[]): TokenState => {
  initialSupply = BigInt(initialSupply)
  if (initialSupply <= 0n) throw new Error('initial supply must be positive')
  if (!Array.isArray(allocations) || allocations.length === 0)
    throw new Error('genesis allocations are required')

  const balances: { [address: address]: bigint } = {}
  let allocated = 0n
  for (const allocation of [...allocations].sort((left, right) =>
    left.address.localeCompare(right.address)
  )) {
    if (!allocation.address || balances[allocation.address] !== undefined)
      throw new Error('invalid or duplicate genesis address')
    const amount = BigInt(allocation.amount)
    if (amount <= 0n) throw new Error('genesis allocation must be positive')
    balances[allocation.address] = amount
    allocated += amount
  }
  if (allocated !== initialSupply) {
    throw new Error(
      `genesis allocations must equal initial supply: expected ${initialSupply}, got ${allocated}`
    )
  }

  return {
    creator: msg.sender,
    createdAt: BigInt(Date.now()),
    roles: {
      OWNER: [msg.sender],
      MINT: [MONETARY_POLICY_AUTHORITY],
      BURN: [MONETARY_POLICY_AUTHORITY]
    },
    holders: BigInt(Object.keys(balances).length),
    balances,
    approvals: {},
    totalSupply: initialSupply
  }
}

export default class Leofcoin extends Token {
  #targetSupply: bigint
  #initialSupply: bigint

  constructor(
    targetSupply: bigint,
    initialSupplyOrState: bigint | LeofcoinState,
    allocations: GenesisAllocation[] = [],
    restoredState?: LeofcoinState
  ) {
    const legacyState =
      initialSupplyOrState &&
      typeof initialSupplyOrState === 'object' &&
      !Array.isArray(initialSupplyOrState)
        ? initialSupplyOrState
        : undefined
    const state = restoredState || legacyState
    const initialSupply = state
      ? BigInt(state.initialSupply ?? state.totalSupply)
      : BigInt(initialSupplyOrState as bigint)
    super('Leofcoin', 'LFC', 18, state || genesisState(initialSupply, allocations))
    this.#targetSupply = state ? BigInt(state.targetSupply) : BigInt(targetSupply)
    this.#initialSupply = initialSupply
    if (this.#targetSupply <= 0n) throw new Error('target supply must be positive')
    if (this.#initialSupply <= 0n || this.#initialSupply > this.#targetSupply) {
      throw new Error('initial supply must be positive and not exceed target supply')
    }
  }

  get targetSupply() {
    return this.#targetSupply
  }
  get initialSupply() {
    return this.#initialSupply
  }
  get name() {
    return 'Leofcoin'
  }
  get symbol() {
    return 'LFC'
  }
  get decimals() {
    return 18
  }

  get state(): LeofcoinState {
    return {
      ...super.state,
      initialSupply: this.#initialSupply,
      targetSupply: this.#targetSupply
    } as LeofcoinState
  }

  grantRole(address: address, role: string) {
    if (role === 'MINT' || role === 'BURN') throw new Error('protocol monetary roles are immutable')
    return super.grantRole(address, role)
  }

  revokeRole(address: address, role: string) {
    if (role === 'MINT' || role === 'BURN') throw new Error('protocol monetary roles are immutable')
    return super.revokeRole(address, role)
  }

  mint(to: address, amount: bigint) {
    if (msg.sender !== MONETARY_POLICY_AUTHORITY)
      throw new Error('only the monetary protocol may mint')
    amount = BigInt(amount)
    if (amount <= 0n) throw new Error('mint amount must be positive')
    if (this.totalSupply + amount > this.#targetSupply)
      throw new Error('mint exceeds target supply')
    return super.mint(to, amount)
  }

  burn(from: address, amount: bigint) {
    if (msg.sender !== MONETARY_POLICY_AUTHORITY)
      throw new Error('only the monetary protocol may burn')
    amount = BigInt(amount)
    if (amount <= 0n) throw new Error('burn amount must be positive')
    if (this.balanceOf(from) < amount) throw new Error('amount exceeds balance')
    return super.burn(from, amount)
  }
}

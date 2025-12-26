# Quick Start: Contract Inheritance

Get started with contract inheritance in 5 minutes.

## Key Concept

Contracts are now **content-addressed** by their hash:
- Contract code → Hash (unique identifier)
- Name → Hash (registered in nameService)
- Deploy by name or hash

**Important:** Base contracts are hashed **without constructor parameters** because each derived contract will use different parameters. The hash identifies the reusable code, not a specific instance.

## Installation

No installation needed - these features are built into `@leofcoin/chain`.

## Basic Usage

### 1. Import

```typescript
import Contract from '@leofcoin/chain/contract'
```

### 2. Register a Base Contract

```typescript
const contract = new Contract(config)

// Define reusable base contract
const baseToken = `
class BaseToken {
  constructor(name, symbol, decimals) {
    this.name = name
    this.symbol = symbol
    this.decimals = decimals
    this.balances = {}
  }

  transfer(from, to, amount) {
    if (!this.balances[from] || this.balances[from] < amount) {
      throw new Error('Insufficient balance')
    }
    if (!this.balances[to]) this.balances[to] = 0
    this.balances[from] -= amount
    this.balances[to] += amount
  }

  balanceOf(address) {
    return this.balances[address] || 0
  }
}
`

// Register it once - returns the hash
// Note: Constructor params are ignored for base contract hashing
const hash = await contract.registerBaseContract('BaseToken', baseToken, [])
console.log(`Registered BaseToken with hash: ${hash}`)
// Output: Registered BaseToken with hash: 0xabc123...

// Same code = same hash, regardless of name or params
const hash2 = await contract.registerBaseContract('BaseTokenCopy', baseToken, ['different', 'params'])
console.log(hash === hash2) // true
```

### 3. Deploy Derived Contracts

```typescript
// Define your custom token
const stakingToken = `
class StakingToken extends BaseToken {
  constructor(name, symbol, decimals) {
    super(name, symbol, decimals)
    this.stakes = {}
  }

  stake(address, amount) {
    if (!this.balances[address] || this.balances[address] < amount) {
      throw new Error('Insufficient balance')
    }
    this.balances[address] -= amount
    if (!this.stakes[address]) this.stakes[address] = 0
    this.stakes[address] += amount
  }

  unstake(address, amount) {
    if (!this.stakes[address] || this.stakes[address] < amount) {
      throw new Error('Insufficient stake')
    }
    this.stakes[address] -= amount
    this.balances[address] += amount
  }
}
`

// Deploy it with inheritance
const result = await contract.deployDerivedContract(
  signer,
  stakingToken,
  'BaseToken',
  ['My Staking Token', 'MST', 18]
)

console.log('Deployed:', result)
```

## Check Inheritance

```typescript
// Parse contract code
const info = contract.parseContractInheritance(stakingToken)
console.log(info)
// Output: {
//   className: 'StakingToken',
//   baseClass: 'BaseToken',
//   hasInheritance: true
// }

// Check class derivation at runtime
class Base {}
class Derived extends Base {}

const isDerived = contract.isDerivedFrom(Derived, Base)
console.log(isDerived) // true
```

## Complete Example

```typescript
import Contract from '@leofcoin/chain/contract'

async function deployTokenFamily(signer) {
  const contract = new Contract({})

  // 1. Register base contract
  const baseToken = `
  class BaseToken {
    constructor(name, symbol) {
      this.name = name
      this.symbol = symbol
      this.balances = {}
    }
    transfer(from, to, amount) { /* ... */ }
    balanceOf(address) { return this.balances[address] || 0 }
  }
  `
  
  await contract.registerBaseContract('BaseToken', baseToken, [])

  // 2. Deploy multiple derived contracts
  const tokens = []

  // Staking token
  const stakingCode = `
  class StakingToken extends BaseToken {
    constructor(name, symbol) {
      super(name, symbol)
      this.stakes = {}
    }
    stake(address, amount) { /* ... */ }
  }
  `
  tokens.push(
    await contract.deployDerivedContract(
      signer, stakingCode, 'BaseToken', ['Staking Token', 'STK']
    )
  )

  // Governance token
  const govCode = `
  class GovernanceToken extends BaseToken {
    constructor(name, symbol) {
      super(name, symbol)
      this.votes = {}
    }
    vote(address, proposal) { /* ... */ }
  }
  `
  tokens.push(
    await contract.deployDerivedContract(
      signer, govCode, 'BaseToken', ['Governance Token', 'GOV']
    )
  )

  // Reward token
  const rewardCode = `
  class RewardToken extends BaseToken {
    constructor(name, symbol) {
      super(name, symbol)
      this.rewards = {}
    }
    claimReward(address) { /* ... */ }
  }
  `
  tokens.push(
    await contract.deployDerivedContract(
      signer, rewardCode, 'BaseToken', ['Reward Token', 'RWD']
    )
  )

  return tokens
}
```

## Tips

### ✅ DO

- Register commonly used base contracts once
- Use descriptive names for base contracts
- Keep base contracts focused and reusable
- Combine multiple base contracts when needed

```typescript
await contract.deployContract(
  signer,
  code,
  params,
  ['BaseToken', 'Ownable', 'Pausable']
)
```

### ❌ DON'T

- Don't register the same base contract multiple times
- Don't use base contracts for one-off functionality
- Don't forget to check if a base exists before deploying

```typescript
// Check first
const registry = contract.getRegistry()
const baseExists = registry.getBaseContract('BaseToken')
if (!baseExists) {
  await contract.registerBaseContract('BaseToken', code, [])
}
```

## Common Patterns

### Pattern 1: Token Family

Register one base token, deploy many variations:
- Staking token
- Governance token
- Reward token
- Liquidity token

### Pattern 2: Access Control

Register security modules:
- Ownable (owner-only functions)
- Pausable (emergency stop)
- Role-based access

### Pattern 3: Upgradeable

Separate logic from storage:
- Storage contract (base)
- Logic contracts (derived)

## Next Steps

- Read [CONTRACT_INHERITANCE.md](CONTRACT_INHERITANCE.md) for full documentation
- See [examples/contract-inheritance-example.ts](examples/contract-inheritance-example.ts) for more examples
- Check [VISUAL_GUIDE.md](VISUAL_GUIDE.md) for architecture diagrams

## Need Help?

```typescript
// Get the registry
const registry = contract.getRegistry()

// List all base contracts
const bases = registry.getBaseContractNames()
console.log('Available bases:', bases)

// Get a specific base
const base = registry.getBaseContract('BaseToken')

// Check dependencies
const deps = registry.getDependencies(contractHash)
const available = await registry.areDependenciesAvailable(contractHash)
```

## API Quick Reference

```typescript
// Check inheritance
contract.isDerivedFrom(DerivedClass, BaseClass): boolean

// Parse contract
contract.parseContractInheritance(code): { className, baseClass, hasInheritance }

// Register base
contract.registerBaseContract(name, code, params): Promise<hash>

// Deploy derived
contract.deployDerivedContract(signer, code, baseName, params): Promise<result>

// Deploy with multiple bases
contract.deployContract(signer, code, params, [bases]): Promise<result>

// Access registry
contract.getRegistry(): ContractRegistry
```

## That's It!

You're now ready to use contract inheritance in your Leofcoin projects. Start by registering your base contracts and deploying derived contracts to save code and reduce costs.

# Contract Inheritance and Reusability

This document explains the new contract inheritance and reusability features added to the Leofcoin chain.

## Overview

The contract system now supports:
- ✅ Checking if a class is derived from another class
- ✅ Registering reusable base contracts
- ✅ Deploying derived contracts that extend base contracts
- ✅ Analyzing contract inheritance chains
- ✅ Managing contract dependencies

## New Files

- `contract-utils.ts` - Utility functions for inheritance checking and parsing
- `contract-registry.ts` - Registry for managing base contracts and dependencies
- `examples/contract-inheritance-example.ts` - Complete usage examples

## Key Features

### 1. Class Inheritance Checking

Check if a class is derived from another class at runtime:

```typescript
import Contract from '@leofcoin/chain/contract'

const contract = new Contract(config)

// Check class inheritance
class BaseClass {}
class DerivedClass extends BaseClass {}

const isDerived = contract.isDerivedFrom(DerivedClass, BaseClass)
console.log(isDerived) // true
```

### 2. Parse Contract Inheritance

Analyze contract code to extract inheritance information:

```typescript
const contractCode = `
class StakingToken extends BaseToken {
  // ... contract code
}
`

const info = contract.parseContractInheritance(contractCode)
// Returns: {
//   className: 'StakingToken',
//   baseClass: 'BaseToken',
//   hasInheritance: true
// }
```

### 3. Register Reusable Base Contracts

Register base contracts that can be reused across multiple deployments:

```typescript
const baseTokenContract = `
class BaseToken {
  constructor(name, symbol, decimals) {
    this.name = name
    this.symbol = symbol
    this.decimals = decimals
    this.balances = {}
  }

  transfer(from, to, amount) {
    // ... transfer logic
  }

  balanceOf(address) {
    return this.balances[address] || 0
  }
}
`

// Register the base contract
const hash = await contract.registerBaseContract(
  'BaseToken',
  baseTokenContract,
  []
)
```

### 4. Deploy Derived Contracts

Deploy contracts that extend registered base contracts:

```typescript
const stakingTokenContract = `
class StakingToken extends BaseToken {
  constructor(name, symbol, decimals) {
    super(name, symbol, decimals)
    this.stakes = {}
  }

  stake(address, amount) {
    // ... staking logic
  }

  unstake(address, amount) {
    // ... unstaking logic
  }
}
`

// Deploy derived contract
const result = await contract.deployDerivedContract(
  signer,
  stakingTokenContract,
  'BaseToken',  // Name of registered base contract
  ['My Staking Token', 'MST', 18]
)
```

### 5. Deploy with Multiple Base Contracts

Combine multiple base contracts in a single deployment:

```typescript
// Register modules
await contract.registerBaseContract('Ownable', ownableModule, [])
await contract.registerBaseContract('Pausable', pausableModule, [])

// Deploy contract using multiple bases
const result = await contract.deployContract(
  signer,
  myContractCode,
  [constructorArg1, constructorArg2],
  ['Ownable', 'Pausable']  // Array of base contract names
)
```

## Benefits

### Code Reuse
- Define common functionality once in base contracts
- Reuse across multiple derived contracts
- Reduces code duplication

### Reduced Deployment Size
- Base contracts are stored once
- Derived contracts only contain new functionality
- Lower gas costs for deployment

### Modular Design
- Separate concerns into focused modules
- Easier to test and audit individual components
- Mix and match functionality as needed

### Maintainability
- Update base contracts independently
- Clear inheritance hierarchy
- Better code organization

## Contract Registry

Access advanced registry features:

```typescript
const registry = contract.getRegistry()

// Get all registered base contracts
const baseContracts = registry.getBaseContractNames()
console.log(baseContracts) // ['BaseToken', 'Ownable', 'Pausable']

// Get a specific base contract
const baseContract = registry.getBaseContract('BaseToken')

// Check contract dependencies
const dependencies = registry.getDependencies(contractHash)
const areDepsAvailable = await registry.areDependenciesAvailable(contractHash)

// Clear registry (useful for testing)
registry.clear()
```

## Common Patterns

### Pattern 1: Token with Extensions

```typescript
// Base token
await contract.registerBaseContract('ERC20', erc20Code, [])

// Deploy token with staking
await contract.deployDerivedContract(
  signer,
  stakingCode,
  'ERC20',
  ['Staking Token', 'STK', 18]
)

// Deploy token with governance
await contract.deployDerivedContract(
  signer,
  governanceCode,
  'ERC20',
  ['Governance Token', 'GOV', 18]
)
```

### Pattern 2: Access Control Modules

```typescript
// Register reusable modules
await contract.registerBaseContract('Ownable', ownableCode, [])
await contract.registerBaseContract('Pausable', pausableCode, [])

// Deploy contract with both modules
await contract.deployContract(
  signer,
  myContractCode,
  [ownerAddress],
  ['Ownable', 'Pausable']
)
```

### Pattern 3: Composable Contracts

```typescript
// Register building blocks
await contract.registerBaseContract('Storage', storageCode, [])
await contract.registerBaseContract('Events', eventsCode, [])
await contract.registerBaseContract('Math', mathCode, [])

// Compose complex contract from building blocks
await contract.deployContract(
  signer,
  complexContractCode,
  [],
  ['Storage', 'Events', 'Math']
)
```

## Migration Guide

### Before (Old Way)

```typescript
// Had to include all code in every contract
const fullContractCode = `
class MyToken {
  // All token functionality here
  // Including common code repeated in every token
  constructor(name, symbol) { ... }
  transfer(from, to, amount) { ... }
  // ... hundreds of lines
}
`

await contract.deployContract(signer, fullContractCode, ['Token', 'TKN'])
```

### After (New Way)

```typescript
// Register base once
await contract.registerBaseContract('BaseToken', baseTokenCode, [])

// Deploy only new functionality
const myTokenCode = `
class MyToken extends BaseToken {
  // Only new functionality
  constructor(name, symbol) {
    super(name, symbol, 18)
  }
  
  // Custom methods
  customFeature() { ... }
}
`

await contract.deployDerivedContract(
  signer,
  myTokenCode,
  'BaseToken',
  ['Token', 'TKN']
)
```

## API Reference

### Contract Methods

#### `isDerivedFrom(derivedClass, baseClass): boolean`
Check if a class is derived from another class.

#### `parseContractInheritance(contractCode: string): object`
Parse contract code to extract inheritance information.

#### `registerBaseContract(name: string, contract: string, params: Array): Promise<string>`
Register a reusable base contract. Returns the contract hash.

#### `deployContract(signer, contract, params, baseContracts): Promise<any>`
Deploy a contract with optional base contracts.

#### `deployDerivedContract(signer, contract, baseName, params): Promise<any>`
Deploy a contract that extends a specific registered base contract.

#### `getRegistry(): ContractRegistry`
Get the contract registry instance for advanced operations.

### ContractRegistry Methods

#### `registerBaseContract(name, message): Promise<void>`
Register a base contract message.

#### `getBaseContract(name): ContractMessage | undefined`
Retrieve a registered base contract by name.

#### `registerDependencies(contractHash, dependencies): void`
Register contract dependencies.

#### `getDependencies(contractHash): string[]`
Get all dependencies for a contract.

#### `areDependenciesAvailable(contractHash): Promise<boolean>`
Check if all dependencies are available.

#### `analyzeContract(contractCode): object`
Analyze contract code for inheritance information.

#### `buildContract(contractCode, baseNames): Promise<string>`
Build a complete contract by combining base contracts.

#### `getBaseContractNames(): string[]`
Get all registered base contract names.

#### `clear(): void`
Clear all registered contracts.

## Examples

See `examples/contract-inheritance-example.ts` for complete working examples including:
- Basic inheritance checking
- Registering and deploying base contracts
- Creating modular contract systems
- Best practices for contract organization

## Testing

Test the new features:

```typescript
import Contract from './contract.js'
import { contractRegistry } from './contract-registry.js'

// Test inheritance checking
const contract = new Contract(config)
class Base {}
class Derived extends Base {}
console.assert(contract.isDerivedFrom(Derived, Base) === true)

// Test contract parsing
const code = `class Token extends BaseToken { }`
const info = contract.parseContractInheritance(code)
console.assert(info.hasInheritance === true)
console.assert(info.baseClass === 'BaseToken')

// Test registry
await contract.registerBaseContract('Test', 'class Test {}', [])
console.assert(contractRegistry.getBaseContractNames().includes('Test'))
```

## Future Enhancements

Potential future improvements:
- Automatic dependency resolution
- Contract versioning
- Interface checking
- Abstract contract support
- Contract composition validation
- Gas optimization through shared bytecode

## Support

For questions or issues, please refer to the examples or open an issue in the repository.

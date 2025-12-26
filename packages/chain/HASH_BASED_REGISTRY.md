# Hash-Based Contract Registry with NameService

## Overview

The contract system now uses **content-addressed hashing** for base contracts:

1. **Hash the contract code** - Each contract is identified by its hash
2. **Register in nameService** - Map human-readable names to hashes
3. **Reference by name or hash** - Flexibility in deployment

## Key Changes

### Before (Name-Based)
```typescript
// Stored by name directly
registry.set('BaseToken', contractMessage)
```

### After (Hash-Based)
```typescript
// Hash the contract code (WITHOUT constructor params for base contracts)
const hash = await contractMessage.hash()

// Store by hash (content-addressed)
registry.set(hash, contractMessage)

// Map name to hash
nameRegistry.set('BaseToken', hash)

// Optionally register in on-chain nameService
await nameService.register('BaseToken', hash)
```

**Important:** Base contracts are hashed **without constructor parameters** because:
- The same base contract code should always produce the same hash
- Constructor parameters are unique to each deployment that uses the base
- The hash identifies the reusable code, not a specific instance

## Benefits

### 1. **Content-Addressed Storage**
- Same code always produces same hash
- Deduplication - identical contracts stored once
- Verifiable - anyone can verify the hash matches the code

### 2. **Namespace Management**
- Multiple names can point to same contract hash
- Aliases: `'ERC20'` and `'BaseToken'` → same hash
- Versioning: `'BaseToken-v1'`, `'BaseToken-v2'`

### 3. **On-Chain Name Registry**
- Names registered in nameService contract
- Decentralized name resolution
- Anyone can lookup name → hash

## API Usage
// Note: constructorParameters parameter is ignored for hashing
// Base contracts are hashed by code only
const hash = await contract.registerBaseContract(
  'BaseToken',      // Name
  baseTokenCode,    // Contract code
  [],               // Constructor params (not used in hash)
  false             // Don't register in nameService yet
)
console.log(`Registered with hash: ${hash}`)

// The same code always produces the same hash
const hash2 = await contract.registerBaseContract(
  'BaseTokenV2',    // Different name
  baseTokenCode,    // Same code
  ['different', 'params'],  // Different params (ignored for hash)
  false
)
console.log(hash === hash2)  // true - same code = same hash
  baseTokenCode,    // Contract code
  [],               // Constructor params
  false             // Don't register in nameService yet
)
console.log(`Registered with hash: ${hash}`)

// Register with on-chain nameService
const hash2 = await contract.registerBaseContract(
  'MyToken',
  myTokenCode,
  [],
  true              // Register in nameService
)
```

### Deploy Using Name or Hash

```typescript
// Deploy by name (resolved to hash)
await contract.deployDerivedContract(
  signer,
  stakingCode,
  'BaseToken',      // Name (looked up in registry)
  params
)

// Deploy by hash (direct reference)
await contract.deployDerivedContract(
  signer,
  stakingCode,
  '0xabc123...',    // Hash (used directly)
  params
)
```

### Lookup Names and Hashes

```typescript
const registry = contract.getRegistry()

// Get hash for a name
const hash = registry.getHashForName('BaseToken')

// Get name for a hash (reverse lookup)
const name = registry.getNameForHash('0xabc123...')

// Get contract by name
const contract = await registry.getBaseContract('BaseToken')

// Get contract by hash
const contract = registry.getBaseContractByHash('0xabc123...')
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Application                         │
└────────────┬───────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│              Contract Class                          │
│  registerBaseContract(name, code, params, onChain)  │
└────────────┬───────────────────────────────────────┘
             │
             ├──────────────┬─────────────────┐
             ▼              ▼                 ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│ contract-utils   │ │  Registry   │ │ nameService  │
│                  │ │             │ │  (on-chain)  │
│ hashContractCode │ │ hash->code  │ │ name->hash   │
└──────────────────┘ │ name->hash  │ └──────────────┘
                     └─────────────┘
```

## Flow Diagram

```
Register Base Contract Flow:
═══════════════════════════

1. Contract Code
   │
   ▼
2. Hash Code → 0xabc123...
   │
   ├─────────────────┬──────────────────┐
   │                 │                  │
   ▼                 ▼                  ▼
3. Store by Hash  Map Name→Hash   (Optional)
   │                 │              Register in
   │                 │              nameService
   ▼                 ▼                  │
   contractStore    Local Registry      ▼
   [hash] → code    'BaseToken'→hash   On-chain
                                       'BaseToken'→hash


Deploy Derived Contract Flow:
═════════════════════════════

1. Provide Name or Hash
   │
   ├────────────┬─────────────┐
   │            │             │
   ▼            ▼             ▼
2. Name?      Hash?       Unknown
   │            │             │
   ▼            ▼             ▼
3. Resolve   Use Direct   Error
   Name→Hash    Hash
   │            │
   └────┬───────┘
        ▼
4. Get Contract by Hash
   │
   ▼
5. Combine with Derived Code
   │
   ▼
6. Deploy
```

## Examples

### Example 1: Simple Registration

```typescript
const baseCode = `
class BaseToken {
  constructor(name) { this.name = name }
  transfer(from, to, amount) { /* ... */ }
}
`

// Register and get hash
const hash = await contract.registerBaseContract(
  'BaseToken',
  baseCode,
  []
)

console.log(`BaseToken hash: ${hash}`)
// Output: BaseToken hash: 0xa1b2c3d4...

// Deploy derived contract using the name
await contract.deployDerivedContract(
  signer,
  derivedCode,
  'BaseToken',  // Name is resolved to hash
  params
)
```

### Example 2: Multiple Names for Same Contract

```typescript
// Register base contract
const hash = await contract.registerBaseContract(
  'ERC20',
  erc20Code,
  []
)

// Add alias
const registry = contract.getRegistry()
// Both names point to same hash
await contract.registerBaseContract('StandardToken', erc20Code, [])

// Deploy using either name
await contract.deployDerivedContract(signer, code, 'ERC20', params)
await contract.deployDerivedContract(signer, code, 'StandardToken', params)
```

### Example 3: On-Chain Name Registry

```typescript
// Register in on-chain nameService
const hash = await contract.registerBaseContract(
  'GlobalToken',
  tokenCode,
  [],
  true  // Register in nameService
)

// Now anyone can resolve this name on-chain
const resolvedHash = await chain.lookup('GlobalToken')
console.log(resolvedHash === hash) // true

// Deploy using the on-chain registered name
await contract.deployDerivedContract(
  signer,
  myCode,
  'GlobalToken',
  params
)
```

### Example 4: Versioned Contracts

```typescript
// Register multiple versions
const v1Hash = await contract.registerBaseContract(
  'Token-v1',
  tokenV1Code,
  []
)

const v2Hash = await contract.registerBaseContract(
  'Token-v2',
  tokenV2Code,
  []
)

// Deploy using specific version
await contract.deployDerivedContract(signer, code, 'Token-v2', params)

// Upgrade by changing which version is used
await contract.deployDerivedContract(signer, code, 'Token-v1', params)
```

## NameService Integration

The nameService contract provides on-chain name resolution:

```typescript
// In your chain
const hash = await chain.lookup('BaseToken')
// Returns: '0xabc123...'

// Register a new name
const tx = {
  from: myAddress,
  to: addresses.nameService,
  method: 'register',
  params: ['MyContract', '0xdef456...']
}
await chain.sendTransaction(tx)
```

## Benefits Summary

| Feature | Name-Based | Hash-Based |
|---------|-----------|------------|
| Uniqueness | Names can conflict | Hashes are unique |
| Verification | Can't verify | Anyone can verify |
| Deduplication | Not possible | Automatic |
| Aliases | Not supported | Multiple names → one hash |
| On-chain | Not decentralized | nameService integration |
| Versioning | Difficult | Easy with versioned names |

## Migration Guide

If you have existing code using name-based registry:

```typescript
// Before
await contract.registerBaseContract('BaseToken', code, [])
await contract.deployDerivedContract(signer, code, 'BaseToken', params)

// After (works the same!)
const hash = await contract.registerBaseContract('BaseToken', code, [])
// hash is now returned, but name resolution still works
await contract.deployDerivedContract(signer, code, 'BaseToken', params)

// New: Can also use hash directly
await contract.deployDerivedContract(signer, code, hash, params)
```

**No breaking changes!** The API is backward compatible.

## Best Practices

### ✅ DO

1. **Store the hash** returned from registration
```typescript
const hash = await contract.registerBaseContract(name, code, [])
// Store hash for later reference
```

2. **Use descriptive names**
```typescript
await contract.registerBaseContract('ERC20-StandardToken-v2', code, [])
```

3. **Verify hashes** before deployment
```typescript
const hash = registry.getHashForName('BaseToken')
console.log('Deploying with base:', hash)
```

4. **Register important contracts on-chain**
```typescript
await contract.registerBaseContract('CoreToken', code, [], true)
```

### ❌ DON'T
// For base contracts, use empty array for constructor parameters
const creator = '0x0000000000000000000000000000000000000000'
const code = 'class Token { }'
const hash = await hashContractCode(creator, code, [])  // Empty params for base contract
console.log(hash) // Contract hash

// Verify same code produces same hash (regardless of params)
const hash2 = await hashContractCode(creator, code, [])
console.assert(hash === hash2)

// Constructor parameters don't affect base contract hash
const hash3 = await hashContractCode(creator, code, ['param1', 'param2'])
console.assert(hash !== hash3) // Different hash if params included

// For base contracts, always use empty params to get consistent hash
const baseHash1 = await hashContractCode(creator, code, [])
const baseHash2 = await hashContractCode(creator, code, [])
console.assert(baseHash1 === baseHash2) // Same hash for base contracts

// Different code produces different hash
const differentCode = 'class Token { constructor() {} }'
const hash4 = await hashContractCode(creator, differentCode, [])
console.assert(baseHash1 produces same hash
const hash2 = await hashContractCode(creator, code, [])
console.assert(hash === hash2)

// Different code produces different hash
const differentCode = 'class Token { constructor() {} }'
const hash3 = await hashContractCode(creator, differentCode, [])
console.assert(hash !== hash3)

// Different constructor parameters produce different hash
const hash4 = await hashContractCode(creator, code, ['param1'])
console.assert(hash !== hash4)
```

## Future Enhancements

- **Automatic nameService sync** - Background sync with on-chain registry
- **Hash verification** - Verify contract code matches claimed hash
- **IPFS integration** - Store contracts on IPFS, use CID as hash
- **Contract discovery** - Browse available contracts by hash
- **Dependency resolution** - Automatically fetch dependencies by hash

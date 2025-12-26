/**
 * Example: Hash-Based Contract Registry with NameService Integration
 *
 * This example demonstrates:
 * 1. Hashing contract code for content-addressed storage
 * 2. Registering contracts by hash with name mappings
 * 3. Using nameService for on-chain name resolution
 * 4. Deploying contracts by name or hash
 */

import Contract from '../contract.js'
import { hashContractCode } from '../contract-utils.js'
import type MultiWallet from '@leofcoin/multi-wallet'

// Example 1: Basic Hash-Based Registration
// ==========================================

export async function exampleHashBasedRegistration(contract: Contract, signer: MultiWallet) {
  const baseToken = `
  class BaseToken {
    constructor(name, symbol, decimals) {
      this.name = name
      this.symbol = symbol
      this.decimals = decimals
      this.balances = {}
      this.totalSupply = 0
    }

    mint(to, amount) {
      if (!this.balances[to]) this.balances[to] = 0
      this.balances[to] += amount
      this.totalSupply += amount
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

  // Step 1: Hash the contract code using ContractMessage's method
  // Base contracts are hashed without constructor parameters
  const creator = await signer.address
  const codeHash = await hashContractCode(creator, baseToken, [])
  console.log(`Contract code hash: ${codeHash}`)

  // Step 2: Register with a name (returns the actual hash from ContractMessage)
  const registeredHash = await contract.registerBaseContract(
    'BaseToken', // Name for human reference
    baseToken, // Contract code
    [] // Constructor params
  )
  console.log(`Registered with hash: ${registeredHash}`)

  // Step 3: Deploy derived contract using the name
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

  // Deploy by name (name is resolved to hash)
  const result = await contract.deployDerivedContract(
    signer,
    stakingToken,
    'BaseToken', // Name is looked up in registry
    ['Staking Token', 'STK', 18]
  )

  return { codeHash, registeredHash, result }
}

// Example 2: On-Chain NameService Registration
// =============================================

export async function exampleNameServiceIntegration(contract: Contract, signer: MultiWallet) {
  const governanceToken = `
  class GovernanceToken {
    constructor(name) {
      this.name = name
      this.proposals = []
      this.votes = {}
    }

    createProposal(creator, description) {
      const proposal = {
        id: this.proposals.length,
        creator,
        description,
        votes: { for: 0, against: 0 },
        executed: false
      }
      this.proposals.push(proposal)
      return proposal.id
    }

    vote(voter, proposalId, support) {
      if (!this.votes[proposalId]) this.votes[proposalId] = {}
      if (this.votes[proposalId][voter]) {
        throw new Error('Already voted')
      }
      this.votes[proposalId][voter] = support
      if (support) this.proposals[proposalId].votes.for++
      else this.proposals[proposalId].votes.against++
    }
  }
  `

  // Register with on-chain nameService integration
  const hash = await contract.registerBaseContract(
    'GovernanceToken',
    governanceToken,
    [],
    true // Register in nameService
  )

  console.log(`Registered 'GovernanceToken' -> ${hash} in nameService`)

  return { hash }
}

// Example 3: Multiple Names for Same Contract (Aliases)
// ======================================================

export async function exampleContractAliases(contract: Contract) {
  const erc20Standard = `
  class ERC20Standard {
    constructor(name, symbol) {
      this.name = name
      this.symbol = symbol
      this.balances = {}
    }
    transfer(from, to, amount) { /* ... */ }
    balanceOf(address) { return this.balances[address] || 0 }
  }
  `

  // Register with primary name
  const hash1 = await contract.registerBaseContract('ERC20', erc20Standard, [])

  // Register with alias (same code, different name)
  const hash2 = await contract.registerBaseContract('StandardToken', erc20Standard, [])

  // Both should have the same hash (same code)
  console.log(`ERC20 hash: ${hash1}`)
  console.log(`StandardToken hash: ${hash2}`)

  // Get registry to check mappings
  const registry = contract.getRegistry()

  const resolvedHash1 = registry.getHashForName('ERC20')
  const resolvedHash2 = registry.getHashForName('StandardToken')

  console.log('Both names resolve to:', { resolvedHash1, resolvedHash2 })

  return { hash1, hash2 }
}

// Example 4: Versioned Contracts
// ===============================

export async function exampleVersionedContracts(contract: Contract, signer: MultiWallet) {
  // Version 1
  const tokenV1 = `
  class Token {
    constructor(name) {
      this.name = name
      this.balances = {}
    }
    transfer(from, to, amount) {
      if (!this.balances[from]) throw new Error('No balance')
      this.balances[from] -= amount
      this.balances[to] = (this.balances[to] || 0) + amount
    }
  }
  `

  // Version 2 with improvements
  const tokenV2 = `
  class Token {
    constructor(name) {
      this.name = name
      this.balances = {}
      this.allowances = {}
    }
    transfer(from, to, amount) {
      if (!this.balances[from] || this.balances[from] < amount) {
        throw new Error('Insufficient balance')
      }
      this.balances[from] -= amount
      this.balances[to] = (this.balances[to] || 0) + amount
    }
    approve(owner, spender, amount) {
      if (!this.allowances[owner]) this.allowances[owner] = {}
      this.allowances[owner][spender] = amount
    }
  }
  `

  // Register both versions
  const v1Hash = await contract.registerBaseContract('Token-v1', tokenV1, [])
  const v2Hash = await contract.registerBaseContract('Token-v2', tokenV2, [])

  console.log(`Token v1 hash: ${v1Hash}`)
  console.log(`Token v2 hash: ${v2Hash}`)

  // Deploy using v2
  const myToken = `
  class MyToken extends Token {
    constructor(name) {
      super(name)
      this.owner = globalThis.peernet?.selectedAccount
    }
  }
  `

  const result = await contract.deployDerivedContract(
    signer,
    myToken,
    'Token-v2', // Use version 2
    ['My Token']
  )

  return { v1Hash, v2Hash, result }
}

// Example 5: Deploy by Hash Directly
// ===================================

export async function exampleDeployByHash(contract: Contract, signer: MultiWallet) {
  // Register base contract
  const baseCode = `
  class Base {
    constructor() { this.data = {} }
    set(key, value) { this.data[key] = value }
    get(key) { return this.data[key] }
  }
  `

  const baseHash = await contract.registerBaseContract('Base', baseCode, [])

  // Deploy derived contract using hash directly (no name lookup)
  const derivedCode = `
  class Derived extends Base {
    constructor() {
      super()
      this.cache = {}
    }
    cachedGet(key) {
      if (this.cache[key]) return this.cache[key]
      const value = this.get(key)
      this.cache[key] = value
      return value
    }
  }
  `

  // Deploy using the hash instead of name
  const result = await contract.deployDerivedContract(
    signer,
    derivedCode,
    baseHash, // Use hash directly
    []
  )

  console.log(`Deployed derived contract using base hash: ${baseHash}`)

  return { baseHash, result }
}

// Example 6: Verify Contract by Hash
// ===================================

export async function exampleVerifyContract(contract: Contract) {
  const code = `
  class VerifiableContract {
    constructor() { this.verified = true }
    isVerified() { return this.verified }
  }
  `

  // Register contract
  const registeredHash = await contract.registerBaseContract('Verifiable', code, [])

  // Anyone can hash the code and verify it matches
  const creator = await contract.selectedAccount()
  const computedHash = await hashContractCode(creator, code, [])

  console.log('Registered hash:', registeredHash)
  console.log('Computed hash:', computedHash)
  console.log('Hashes match:', registeredHash === computedHash ? 'YES' : 'NO')

  // Get the contract by hash and verify the code
  const registry = contract.getRegistry()
  const storedContract = registry.getBaseContractByHash(registeredHash)

  if (storedContract) {
    const storedCode = storedContract.decoded.contract
    // Ensure code is string
    const codeString = typeof storedCode === 'string' ? storedCode : new TextDecoder().decode(storedCode)
    const creator = storedContract.decoded.creator
    // Base contracts are stored without constructor parameters
    const storedCodeHash = await hashContractCode(creator, codeString, [])
    console.log('Stored code hash matches:', storedCodeHash === registeredHash)
  }

  return { registeredHash, computedHash }
}

// Example 7: Contract Discovery
// ==============================

export async function exampleContractDiscovery(contract: Contract) {
  // Register several contracts
  await contract.registerBaseContract('TokenA', 'class TokenA {}', [])
  await contract.registerBaseContract('TokenB', 'class TokenB {}', [])
  await contract.registerBaseContract('TokenC', 'class TokenC {}', [])

  const registry = contract.getRegistry()

  // List all registered names
  const names = registry.getBaseContractNames()
  console.log('Registered contract names:', names)

  // List all registered hashes
  const hashes = registry.getBaseContractHashes()
  console.log('Registered contract hashes:', hashes)

  // Map each name to its hash
  const nameToHash = {}
  for (const name of names) {
    nameToHash[name] = registry.getHashForName(name)
  }
  console.log('Name -> Hash mappings:', nameToHash)

  // Map each hash to its name
  const hashToName = {}
  for (const hash of hashes) {
    hashToName[hash] = registry.getNameForHash(hash)
  }
  console.log('Hash -> Name mappings:', hashToName)

  return { names, hashes, nameToHash, hashToName }
}

// Example 8: Complex Dependency Resolution
// =========================================

export async function exampleDependencyResolution(contract: Contract, signer: MultiWallet) {
  // Base contract
  const storage = `
  class Storage {
    constructor() { this.data = {} }
    set(key, value) { this.data[key] = value }
    get(key) { return this.data[key] }
  }
  `

  // Middleware contract
  const validation = `
  class Validation extends Storage {
    constructor() {
      super()
      this.validators = {}
    }
    addValidator(key, validator) {
      this.validators[key] = validator
    }
    set(key, value) {
      if (this.validators[key] && !this.validators[key](value)) {
        throw new Error('Validation failed')
      }
      super.set(key, value)
    }
  }
  `

  // Application contract
  const userStorage = `
  class UserStorage extends Validation {
    constructor() {
      super()
      this.addValidator('email', (email) => email.includes('@'))
      this.addValidator('age', (age) => age >= 18)
    }
    registerUser(id, email, age) {
      this.set(\`\${id}-email\`, email)
      this.set(\`\${id}-age\`, age)
    }
  }
  `

  // Register all layers
  const storageHash = await contract.registerBaseContract('Storage', storage, [])
  const validationHash = await contract.registerBaseContract('Validation', validation, [])

  // Deploy with multiple base contracts
  const result = await contract.deployContract(
    signer,
    userStorage,
    [],
    ['Storage', 'Validation'] // Include both base contracts
  )

  console.log('Deployed complex contract with dependencies')
  console.log('Storage hash:', storageHash)
  console.log('Validation hash:', validationHash)

  return { storageHash, validationHash, result }
}

// Export all examples
export default {
  exampleHashBasedRegistration,
  exampleNameServiceIntegration,
  exampleContractAliases,
  exampleVersionedContracts,
  exampleDeployByHash,
  exampleVerifyContract,
  exampleContractDiscovery,
  exampleDependencyResolution
}

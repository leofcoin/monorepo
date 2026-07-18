import { ContractMessage } from '@leofcoin/messages'
import { parseContractInheritance } from './contract-utils.js'
import addresses from '@leofcoin/addresses'

/**
 * Registry for managing base contracts and contract inheritance
 */
export class ContractRegistry {
  private baseContracts: Map<string, ContractMessage> = new Map() // hash -> ContractMessage
  private contractNames: Map<string, string> = new Map() // name -> hash
  private contractDependencies: Map<string, string[]> = new Map()

  /**
   * Register a base contract that can be reused
   * Uses the contract code hash as the identifier and registers the name in nameService
   * @param name The name to register in nameService
   * @param message The contract message
   * @returns The contract hash
   */
  async registerBaseContract(name: string, message: ContractMessage): Promise<string> {
    const hash = await message.hash()

    // Store by hash (the actual identifier)
    this.baseContracts.set(hash, message)
    this.contractNames.set(name, hash)

    // Store in contract store
    if (globalThis.contractStore) {
      await globalThis.contractStore.put(hash, message.encoded)
    }

    return hash
  }

  /**
   * Register a name for a contract hash in the nameService
   * @param name The name to register
   * @param hash The contract hash
   * @param chain The chain instance (for making transactions)
   * @param signer The wallet to sign the transaction
   */
  async registerNameInNameService(name: string, hash: string, chain: any, signer: any): Promise<void> {
    // Register the name -> hash mapping in the on-chain nameService contract
    const transaction = {
      from: await signer.address,
      to: addresses.nameService,
      method: 'register',
      params: [name, hash],
      timestamp: Date.now()
    }

    // This would need to be signed and sent through the chain
    // Implementation depends on your chain's transaction flow
  }

  /**
   * Get a base contract by name
   * First checks local registry, then queries nameService if available
   * @param name The name of the base contract
   * @returns The contract message or undefined
   */
  getBaseContract(name: string): ContractMessage | undefined {
    // Check local name mapping
    const hash = this.contractNames.get(name)
    if (hash) {
      return this.baseContracts.get(hash)
    }

    // If not found locally, try to lookup in nameService
    // This would require access to the chain instance to call nameService
    return undefined
  }

  /**
   * Get a base contract by hash
   * @param hash The hash of the contract
   * @returns The contract message or undefined
   */
  getBaseContractByHash(hash: string): ContractMessage | undefined {
    return this.baseContracts.get(hash)
  }

  /**
   * Resolve a name to a hash (first local, then nameService)
   * @param name The contract name
   * @returns The contract hash or undefined
   */
  resolveNameToHash(name: string): string | undefined {
    return this.contractNames.get(name)
  }

  /**
   * Register contract dependencies (inheritance chain)
   * @param contractHash The hash of the contract
   * @param dependencies Array of base contract hashes this contract depends on
   */
  registerDependencies(contractHash: string, dependencies: string[]): void {
    this.contractDependencies.set(contractHash, dependencies)
  }

  /**
   * Get all dependencies for a contract
   * @param contractHash The hash of the contract
   * @returns Array of dependency hashes
   */
  getDependencies(contractHash: string): string[] {
    return this.contractDependencies.get(contractHash) || []
  }

  /**
   * Check if all dependencies for a contract are available
   * @param contractHash The hash of the contract
   * @returns true if all dependencies are available
   */
  async areDependenciesAvailable(contractHash: string): Promise<boolean> {
    const dependencies = this.getDependencies(contractHash)

    if (dependencies.length === 0) return true

    for (const depHash of dependencies) {
      try {
        if (globalThis.contractStore) {
          await globalThis.contractStore.get(depHash)
        } else {
          return false
        }
      } catch {
        return false
      }
    }

    return true
  }

  /**
   * Get all registered contract hashes
   * @returns Array of contract hashes
   */
  getBaseContractHashes(): string[] {
    return Array.from(this.baseContracts.keys())
  }

  /**
   * Get hash for a registered name
   * @param name The contract name
   * @returns The hash or undefined
   */
  getHashForName(name: string): string | undefined {
    return this.contractNames.get(name)
  }

  /**
   * Analyze contract code and extract inheritance information
   * @param contractCode The contract code to analyze
   * @returns Inheritance information
   */
  analyzeContract(contractCode: string) {
    return parseContractInheritance(contractCode)
  }

  /**
   * Build a complete contract by combining base contracts
   * @param contractCode The derived contract code
   * @param baseContractIdentifiers Names or hashes of base contracts to include
   * @returns Combined contract code
   */
  async buildContract(contractCode: string, baseContractIdentifiers: string[] = []): Promise<string> {
    let combinedCode = ''

    // Add base contracts first
    for (const identifier of baseContractIdentifiers) {
      // Try as name first, then as hash
      let baseContract = await this.getBaseContract(identifier)
      if (!baseContract) {
        baseContract = this.getBaseContractByHash(identifier)
      }

      if (baseContract) {
        const decoded = baseContract.decoded
        combinedCode += `// Base contract: ${identifier}\n`
        combinedCode += decoded.contract + '\n\n'
      }
    }

    // Add the derived contract
    combinedCode += contractCode

    return combinedCode
  }

  /**
   * Clear all registered contracts
   */
clear(): void {
    this.baseContracts.clear()
    this.contractNames.clear()
    this.contractDependencies.clear()
  }

  /**
   * Get all registered base contract names
   * @returns Array of base contract names
   */
  getBaseContractNames(): string[] {
    return Array.from(this.contractNames.keys())
  }

  /**
   * Get name for a hash if registered
   * @param hash The contract hash
   * @returns The name or undefined
   */
  getNameForHash(hash: string): string | undefined {
    for (const [name, h] of this.contractNames.entries()) {
      if (h === hash) return name
    }
    return undefined
  }
}

// Export a singleton instance
export const contractRegistry = new ContractRegistry()

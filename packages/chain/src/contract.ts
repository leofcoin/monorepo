import Transaction from './transaction.js'
import { createContractMessage, signTransaction } from '@leofcoin/lib'
import type MultiWallet from '@leofcoin/multi-wallet'
import { contractRegistry } from './contract-registry.js'
import { isDerivedFrom, parseContractInheritance } from './contract-utils.js'
import type { ChainConfig } from './types.js'
import type { ContractMessage } from '@leofcoin/messages'

async function signerAddress(signer: MultiWallet): Promise<string> {
  const address = await signer.address
  if (!address) throw new Error('Contract signer has no address')
  return address
}
/**
 * @extends {Transaction}
 */
export default class Contract extends Transaction {
  constructor(config?: ChainConfig) {
    super(config)
  }

  /**
   *
   * @param {Address} creator
   * @param {String} contract
   * @param {Array} constructorParameters
   * @returns lib.createContractMessage
   */
  async createContractMessage(creator: string, contract: string | Uint8Array, constructorParameters: unknown[] = []) {
    return createContractMessage(creator, contract, constructorParameters)
  }

  /**
   *
   * @param {Address} creator
   * @param {String} contract
   * @param {Array} constructorParameters
   * @returns {Address}
   */
  async createContractAddress(creator: string, contract: string | Uint8Array, constructorParameters: unknown[] = []) {
    const message = await this.createContractMessage(creator, contract, constructorParameters)
    return message.hash()
  }

  /**
   *
   * @param {String} contract
   * @param {Array} parameters
   * @returns
   */
  async deployContract(signer: MultiWallet, contract: string | Uint8Array, constructorParameters: unknown[] = []) {
    const message = await createContractMessage(await signerAddress(signer), contract, constructorParameters)
    return this.deployContractMessage(signer, message)
  }

  /**
   * Register a base contract for reuse by other contracts
   * The contract is stored by its hash, enabling inheritance and code reuse
   * @param {String} name The name to register for this contract
   * @param {String} contract The contract code
   * @param {Array} constructorParameters Constructor parameters
   * @returns {Promise<string>} The contract hash
   */
  async registerBaseContract(name: string, contract: string, constructorParameters: unknown[] = []) {
    const creator = this.chainAddresses.contractFactory
    // Base contracts are hashed without constructor parameters
    const message = await createContractMessage(creator, contract, [])
    const hash = await contractRegistry.registerBaseContract(name, message)

    // Store the contract by its hash
    try {
      await globalThis.contractStore.put(hash, message.encoded)
    } catch (error) {
      throw error
    }

    return hash
  }

  /**
   * Deploy a contract with optional base contracts for inheritance
   * @param {MultiWallet} signer The wallet to sign with
   * @param {String} contract The contract code
   * @param {Array} constructorParameters Constructor parameters
   * @param {Array<string>} baseContracts Optional array of base contract names or hashes
   * @returns Transaction result
   */
  async deployDerivedContract(
    signer: MultiWallet,
    contract: string,
    baseContractIdentifier?: string,
    constructorParameters: unknown[] = []
  ) {
    // Try to get base contract by name or hash
    if (baseContractIdentifier) {
      const baseContract =
        contractRegistry.getBaseContract(baseContractIdentifier) ??
        contractRegistry.getBaseContractByHash(baseContractIdentifier)
      if (!baseContract) {
        throw new Error(
          `Base contract '${baseContractIdentifier}' not found. Register it first using registerBaseContract.`
        )
      }
    }

    // Parse contract to check for inheritance
    const inheritanceInfo = parseContractInheritance(contract)

    // Deploy the contract
    const message = await createContractMessage(await signerAddress(signer), contract, constructorParameters)

    // If contract has dependencies, register them
    if (inheritanceInfo.hasInheritance && inheritanceInfo.baseClass && baseContractIdentifier) {
      const baseHash = contractRegistry.getHashForName(inheritanceInfo.baseClass)
      if (baseHash) {
        const contractHash = await message.hash()
        contractRegistry.registerDependencies(contractHash, [baseHash])
      }
    }

    return this.deployContractMessage(signer, message)
  }

  async deployContractMessage(signer: MultiWallet, message: ContractMessage) {
    const from = await signerAddress(signer)
    try {
      await globalThis.contractStore.put(await message.hash(), message.encoded)
    } catch (error) {
      throw error
    }
    const transaction = {
      from,
      to: this.chainAddresses.contractFactory,
      method: 'registerContract',
      params: [await message.hash()]
    }
    const signed = await signTransaction(await this.createTransaction(transaction), signer)
    return this.sendTransaction(signed)
  }

  /**
   * Check if a class is derived from another class
   * @param derivedClass The class to check
   * @param baseClass The potential base class
   * @returns true if derivedClass extends baseClass
   */
  isDerivedFrom(derivedClass: any, baseClass: any): boolean {
    return isDerivedFrom(derivedClass, baseClass)
  }

  /**
   * Parse contract code to extract inheritance information
   * @param contractCode The contract code to parse
   * @returns Inheritance information
   */
  parseContractInheritance(contractCode: string) {
    return parseContractInheritance(contractCode)
  }

  /**
   * Get the contract registry instance
   * @returns {ContractRegistry} The contract registry
   */
  getRegistry() {
    return contractRegistry
  }
}

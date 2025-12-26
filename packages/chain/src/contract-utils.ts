/**
 * Utility functions for contract inheritance and code reuse
 */
import { ContractMessage } from '@leofcoin/messages'

/**
 * Create a hash from contract code using ContractMessage's hash method
 * For base contracts, omit constructorParameters to hash only the code
 * @param creator The creator address
 * @param contractCode The contract code to hash
 * @param constructorParameters Constructor parameters (omit for base contracts)
 * @returns Promise<string> The hash of the contract
 */
export const hashContractCode = async (
  creator: string,
  contractCode: string,
  constructorParameters: any[] = []
): Promise<string> => {
  const message = await new ContractMessage({
    creator,
    contract: contractCode,
    constructorParameters
  })
  return message.hash()
}

/**
 * Check if a class is derived from another class
 * @param derivedClass The class to check
 * @param baseClass The potential base class
 * @returns true if derivedClass extends baseClass
 */
export const isDerivedFrom = (derivedClass: any, baseClass: any): boolean => {
  if (!derivedClass || !baseClass) return false

  let proto = Object.getPrototypeOf(derivedClass)
  while (proto) {
    if (proto === baseClass) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

/**
 * Check if a class instance is derived from another class
 * @param instance The instance to check
 * @param baseClass The potential base class
 * @returns true if instance's class extends baseClass
 */
export const isInstanceOf = (instance: any, baseClass: any): boolean => {
  return instance instanceof baseClass
}

/**
 * Get the inheritance chain of a class
 * @param classConstructor The class to get the inheritance chain for
 * @returns Array of class names in the inheritance chain
 */
export const getInheritanceChain = (classConstructor: any): string[] => {
  const chain: string[] = []
  let current = classConstructor

  while (current && current.name) {
    chain.push(current.name)
    current = Object.getPrototypeOf(current)
  }

  return chain
}

/**
 * Extract base contract code from a contract
 * Useful for separating reusable code into base contracts
 * @param contractCode The contract code to analyze
 * @returns Object with base contract and derived contract code
 */
export const extractBaseContract = (contractCode: string): { baseCode: string; derivedCode: string } => {
  // This is a simple implementation - can be enhanced based on your needs
  const classMatch = contractCode.match(/class\s+(\w+)\s+extends\s+(\w+)/)

  if (!classMatch) {
    return { baseCode: '', derivedCode: contractCode }
  }

  // Return the original code - in practice, you'd parse and split the code
  return {
    baseCode: '// Base contract code would be extracted here',
    derivedCode: contractCode
  }
}

/**
 * Parse contract inheritance information from contract code
 * @param contractCode The contract code to parse
 * @returns Information about the contract's inheritance
 */
export const parseContractInheritance = (
  contractCode: string
): {
  className: string | null
  baseClass: string | null
  hasInheritance: boolean
} => {
  const classMatch = contractCode.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?/)

  if (!classMatch) {
    return { className: null, baseClass: null, hasInheritance: false }
  }

  return {
    className: classMatch[1],
    baseClass: classMatch[2] || null,
    hasInheritance: !!classMatch[2]
  }
}

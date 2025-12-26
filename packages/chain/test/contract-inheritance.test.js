import { test } from '@leofcoin/test-suite'
import Contract from '../src/contract.js'
import { contractRegistry } from '../src/contract-registry.js'
import { isDerivedFrom, parseContractInheritance, hashContractCode } from '../src/contract-utils.js'

test('Contract inheritance utilities', async (t) => {
  // Test 0: Hash contract code using ContractMessage
  const creator = '0x0000000000000000000000000000000000000000'
  const code1 = 'class Token { }'
  const hash1 = await hashContractCode(creator, code1, [])
  t.ok(typeof hash1 === 'string', 'should return hash as string')

  // Same code with same creator should produce same hash
  const hash1Again = await hashContractCode(creator, code1, [])
  t.equal(hash1, hash1Again, 'same code should produce same hash')

  // Different code should produce different hash
  const code2 = 'class Token { constructor() {} }'
  const hash2 = await hashContractCode(creator, code2, [])
  t.notEqual(hash1, hash2, 'different code should produce different hash')

  // Test 1: Check class derivation
  class BaseClass {}
  class DerivedClass extends BaseClass {}
  class UnrelatedClass {}

  t.equal(isDerivedFrom(DerivedClass, BaseClass), true, 'should detect derived class')
  t.equal(isDerivedFrom(UnrelatedClass, BaseClass), false, 'should not detect unrelated class')
  t.equal(isDerivedFrom(BaseClass, DerivedClass), false, 'should not detect reverse inheritance')

  // Test 2: Parse contract inheritance
  const contractWithInheritance = `
  class StakingToken extends BaseToken {
    constructor() {
      super()
    }
  }
  `

  const contractWithoutInheritance = `
  class SimpleToken {
    constructor() {
      this.balance = 0
    }
  }
  `

  const info1 = parseContractInheritance(contractWithInheritance)
  t.equal(info1.className, 'StakingToken', 'should extract class name')
  t.equal(info1.baseClass, 'BaseToken', 'should extract base class')
  t.equal(info1.hasInheritance, true, 'should detect inheritance')

  const info2 = parseContractInheritance(contractWithoutInheritance)
  t.equal(info2.className, 'SimpleToken', 'should extract class name without inheritance')
  t.equal(info2.baseClass, null, 'should return null for no base class')
  t.equal(info2.hasInheritance, false, 'should not detect inheritance when none exists')

  // Test 3: Contract registry with hash-based storage
  contractRegistry.clear() // Start fresh

  const baseContractCode = `
  class BaseToken {
    constructor(name) {
      this.name = name
    }
  }
  `

  // Create a mock contract message
  const mockMessage = {
    decoded: { contract: baseContractCode },
    encoded: new Uint8Array([1, 2, 3]),
    hash: async () => 'mock-hash-123'
  }

  const hash = await contractRegistry.registerBaseContract('BaseToken', mockMessage)
  t.equal(hash, 'mock-hash-123', 'should return hash on registration')

  // Test retrieval by name
  const retrievedContract = await contractRegistry.getBaseContract('BaseToken')
  t.ok(retrievedContract, 'should retrieve registered base contract by name')
  t.equal(retrievedContract.decoded.contract, baseContractCode, 'should retrieve correct contract code')

  // Test retrieval by hash
  const retrievedByHash = contractRegistry.getBaseContractByHash('mock-hash-123')
  t.ok(retrievedByHash, 'should retrieve registered base contract by hash')

  // Test name -> hash mapping
  const resolvedHash = contractRegistry.getHashForName('BaseToken')
  t.equal(resolvedHash, 'mock-hash-123', 'should resolve name to hash')

  // Test hash -> name reverse lookup
  const resolvedName = contractRegistry.getNameForHash('mock-hash-123')
  t.equal(resolvedName, 'BaseToken', 'should resolve hash to name')

  const baseNames = contractRegistry.getBaseContractNames()
  t.ok(baseNames.includes('BaseToken'), 'should list registered base contract names')

  const baseHashes = contractRegistry.getBaseContractHashes()
  t.ok(baseHashes.includes('mock-hash-123'), 'should list registered base contract hashes')

  // Test 4: Contract dependencies
  contractRegistry.registerDependencies('contract-hash-1', ['dep-hash-1', 'dep-hash-2'])
  const deps = contractRegistry.getDependencies('contract-hash-1')
  t.equal(deps.length, 2, 'should register and retrieve dependencies')
  t.ok(deps.includes('dep-hash-1'), 'should include first dependency')
  t.ok(deps.includes('dep-hash-2'), 'should include second dependency')

  // Test 5: Build contract
  const derivedCode = `class DerivedToken extends BaseToken {}`
  const builtContract = await contractRegistry.buildContract(derivedCode, ['BaseToken'])
  t.ok(builtContract.includes('BaseToken'), 'should include base contract in built code')
  t.ok(builtContract.includes('DerivedToken'), 'should include derived contract in built code')

  contractRegistry.clear()
})

test('Contract class integration', async (t) => {
  // Create a mock contract instance
  const mockConfig = {}
  const contract = new Contract(mockConfig)

  // Test isDerivedFrom method
  class A {}
  class B extends A {}

  t.equal(contract.isDerivedFrom(B, A), true, 'Contract.isDerivedFrom should work')

  // Test parseContractInheritance method
  const code = `class Token extends ERC20 {}`
  const info = contract.parseContractInheritance(code)
  t.equal(info.className, 'Token', 'should parse class name via Contract method')
  t.equal(info.baseClass, 'ERC20', 'should parse base class via Contract method')

  // Test getRegistry method
  const registry = contract.getRegistry()
  t.equal(registry, contractRegistry, 'should return correct registry instance')
})

export default test

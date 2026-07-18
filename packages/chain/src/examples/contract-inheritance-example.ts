/**
 * Example: Using Contract Inheritance and Base Contracts
 *
 * This example demonstrates how to:
 * 1. Check if a class is derived from another class
 * 2. Register reusable base contracts
 * 3. Deploy derived contracts that extend base contracts
 */

import Contract from '../contract.js'
import type MultiWallet from '@leofcoin/multi-wallet'

// Example base contract code
const baseTokenContract = `
class BaseToken {
  constructor(name, symbol, decimals) {
    this.name = name
    this.symbol = symbol
    this.decimals = decimals
    this.totalSupply = 0
    this.balances = {}
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

// Example derived contract that extends the base
const stakingTokenContract = `
class StakingToken extends BaseToken {
  constructor(name, symbol, decimals) {
    super(name, symbol, decimals)
    this.stakes = {}
    this.stakingRewards = {}
  }

  stake(address, amount) {
    if (!this.balances[address] || this.balances[address] < amount) {
      throw new Error('Insufficient balance to stake')
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

  getStake(address) {
    return this.stakes[address] || 0
  }

  distributeRewards(address, reward) {
    if (!this.stakingRewards[address]) this.stakingRewards[address] = 0
    this.stakingRewards[address] += reward
  }
}
`

/**
 * Example usage of the contract system
 */
export async function exampleContractDeployment(contractInstance: Contract, signer: MultiWallet) {
  // 1. Register a base contract for reuse
  console.log('Registering base token contract...')
  const baseHash = await contractInstance.registerBaseContract('BaseToken', baseTokenContract, [])
  console.log(`Base contract registered with hash: ${baseHash}`)

  // 2. Check inheritance in contract code
  const inheritanceInfo = contractInstance.parseContractInheritance(stakingTokenContract)
  console.log('Contract inheritance info:', inheritanceInfo)
  // Output: { className: 'StakingToken', baseClass: 'BaseToken', hasInheritance: true }

  // 3. Deploy a derived contract that extends the base
  console.log('Deploying staking token contract...')
  const deployResult = await contractInstance.deployDerivedContract(signer, stakingTokenContract, 'BaseToken', [
    'My Staking Token',
    'MST',
    18
  ])
  console.log('Staking token deployed:', deployResult)

  // 4. Alternative: Deploy with explicit base contracts array
  const altDeployResult = await contractInstance.deployContract(
    signer,
    stakingTokenContract,
    ['My Token', 'MTK', 18],
    ['BaseToken'] // Include base contracts
  )
  console.log('Alternative deployment:', altDeployResult)

  // 5. Check if classes are derived (for runtime checking)
  class BaseClass {}
  class DerivedClass extends BaseClass {}

  const isDerived = contractInstance.isDerivedFrom(DerivedClass, BaseClass)
  console.log('Is DerivedClass derived from BaseClass?', isDerived) // true

  // 6. Get contract registry for advanced operations
  const registry = contractInstance.getRegistry()
  const availableBases = registry.getBaseContractNames()
  console.log('Available base contracts:', availableBases)

  return {
    baseHash,
    deployResult,
    altDeployResult
  }
}

/**
 * Example: Creating a modular contract system
 */
export async function exampleModularContracts(contractInstance: Contract, signer: MultiWallet) {
  // Define reusable contract modules
  const ownableModule = `
  class Ownable {
    constructor(owner) {
      this.owner = owner
    }

    onlyOwner(caller) {
      if (caller !== this.owner) {
        throw new Error('Only owner can call this function')
      }
    }

    transferOwnership(newOwner) {
      this.owner = newOwner
    }
  }
  `

  const pausableModule = `
  class Pausable {
    constructor() {
      this.paused = false
    }

    pause() {
      this.paused = true
    }

    unpause() {
      this.paused = false
    }

    requireNotPaused() {
      if (this.paused) {
        throw new Error('Contract is paused')
      }
    }
  }
  `

  // Register modules
  await contractInstance.registerBaseContract('Ownable', ownableModule, [])
  await contractInstance.registerBaseContract('Pausable', pausableModule, [])

  // Create a contract that uses multiple modules
  const multiModuleContract = `
  class MyContract extends Ownable {
    constructor(owner, initialValue) {
      super(owner)
      this.value = initialValue
      this.pausable = new Pausable()
    }

    setValue(caller, newValue) {
      this.onlyOwner(caller)
      this.pausable.requireNotPaused()
      this.value = newValue
    }

    pause(caller) {
      this.onlyOwner(caller)
      this.pausable.pause()
    }

    unpause(caller) {
      this.onlyOwner(caller)
      this.pausable.unpause()
    }
  }
  `

  // Deploy the multi-module contract
  const result = await contractInstance.deployContract(
    signer,
    multiModuleContract,
    [await signer.address, 100],
    ['Ownable', 'Pausable']
  )

  return result
}

/**
 * Example: Best practices for contract organization
 */
export const contractBestPractices = {
  // 1. Separate concerns into reusable base contracts
  baseContracts: [
    'Ownable', // Access control
    'Pausable', // Emergency stop
    'BaseToken', // Token functionality
    'Upgradeable' // Upgrade logic
  ],

  // 2. Build derived contracts that compose base contracts
  derivedContracts: [
    'StakingToken', // BaseToken + staking
    'GovernanceToken', // BaseToken + Ownable + voting
    'PausableToken' // BaseToken + Pausable
  ],

  // 3. Benefits of this approach:
  benefits: [
    'Code reuse across contracts',
    'Reduced deployment size',
    'Easier testing and auditing',
    'Modular and maintainable code',
    'Gas optimization through shared code'
  ]
}

export default {
  exampleContractDeployment,
  exampleModularContracts,
  contractBestPractices
}

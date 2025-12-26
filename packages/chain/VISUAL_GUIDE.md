# Contract Inheritance System - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│                                                                   │
│  Your code using the Contract class to deploy and manage        │
│  contracts with inheritance support                             │
└────────────┬───────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Contract Class                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  New Methods:                                            │  │
│  │  • isDerivedFrom()                                       │  │
│  │  • parseContractInheritance()                           │  │
│  │  • registerBaseContract()                               │  │
│  │  • deployContract() (enhanced)                          │  │
│  │  • deployDerivedContract()                              │  │
│  │  • getRegistry()                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────┬──────────────────────────┘
             │                           │
             │                           │
             ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│   contract-utils.ts     │   │  contract-registry.ts       │
│                         │   │                             │
│  • isDerivedFrom()      │   │  • ContractRegistry class   │
│  • isInstanceOf()       │   │  • registerBaseContract()   │
│  • getInheritanceChain()│   │  • getBaseContract()        │
│  • parseContractInheri..│   │  • registerDependencies()   │
│  • extractBaseContract()│   │  • getDependencies()        │
│                         │   │  • buildContract()          │
└─────────────────────────┘   └───────────┬─────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  Contract Storage         │
                              │  (globalThis.contractStore)│
                              └───────────────────────────┘
```

## Contract Inheritance Flow

### Traditional Deployment (Before)

```
┌─────────────────────┐
│  Full Contract Code │
│                     │
│  class Token {      │
│    // 500 lines     │
│    // of code       │
│  }                  │
└──────────┬──────────┘
           │
           │ Deploy entire contract
           ▼
┌──────────────────────┐
│   Contract Store     │
│                      │
│  Hash1 → Full Code   │
└──────────────────────┘
```

### With Inheritance (After)

```
Step 1: Register Base Contract
┌─────────────────────┐
│  Base Contract      │
│                     │
│  class BaseToken {  │
│    // 200 lines     │
│  }                  │
└──────────┬──────────┘
           │
           │ Register once
           ▼
┌──────────────────────────────┐
│   Contract Registry          │
│                              │
│  "BaseToken" → Hash1         │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   Contract Store             │
│                              │
│  Hash1 → Base Code           │
└──────────────────────────────┘

Step 2: Deploy Derived Contracts
┌─────────────────────┐       ┌─────────────────────┐
│  Staking Contract   │       │  Governance Contract│
│                     │       │                     │
│  extends BaseToken  │       │  extends BaseToken  │
│  // 100 lines       │       │  // 150 lines       │
└──────────┬──────────┘       └──────────┬──────────┘
           │                              │
           │ Deploy (references Hash1)    │
           ▼                              ▼
┌──────────────────────────────────────────────────┐
│   Contract Store                                 │
│                                                  │
│  Hash1 → Base Code                              │
│  Hash2 → Staking Code (+ dependency: Hash1)    │
│  Hash3 → Governance Code (+ dependency: Hash1)  │
└──────────────────────────────────────────────────┘
```

## Workflow Example

```
Developer Workflow
══════════════════

1. Design Base Contracts
   ┌────────────────┐
   │  BaseToken     │
   │  Ownable       │
   │  Pausable      │
   └────────────────┘
          │
          ▼
2. Register Base Contracts
   ┌────────────────────────────────┐
   │  contractRegistry              │
   │    .registerBaseContract()     │
   └────────────────────────────────┘
          │
          ▼
3. Design Derived Contracts
   ┌────────────────────────────────┐
   │  class StakingToken extends    │
   │    BaseToken, Ownable          │
   └────────────────────────────────┘
          │
          ▼
4. Deploy with Inheritance
   ┌────────────────────────────────┐
   │  contract.deployDerivedContract│
   │    (signer, code, 'BaseToken') │
   └────────────────────────────────┘
          │
          ▼
5. Contract Ready to Use
   ┌────────────────────────────────┐
   │  Deployed contract with full   │
   │  functionality from base +     │
   │  derived implementations       │
   └────────────────────────────────┘
```

## Code Reuse Pattern

```
Base Contract Library
═════════════════════

     ┌─────────────┐
     │  BaseToken  │
     └─────┬───────┘
           │
    ┌──────┼──────┬────────┬─────────┐
    │      │      │        │         │
    ▼      ▼      ▼        ▼         ▼
┌────────┐ ┌──┐ ┌───┐  ┌───────┐ ┌──────┐
│Staking │ │NFT│ │Gov│  │Lending│ │Reward│
│Token   │ │   │ │   │  │Token  │ │Token │
└────────┘ └───┘ └───┘  └───────┘ └──────┘

Each derived contract inherits from BaseToken
but only contains its unique functionality
```

## Composition Pattern

```
Multiple Base Contracts
═══════════════════════

┌─────────┐  ┌──────────┐  ┌──────────┐
│ Ownable │  │ Pausable │  │ BaseToken│
└────┬────┘  └────┬─────┘  └────┬─────┘
     │            │              │
     └────────────┼──────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │  MyComplexToken  │
        │                  │
        │  Combines all    │
        │  three bases     │
        └──────────────────┘
```

## Dependency Resolution

```
Contract Deployment with Dependencies
══════════════════════════════════════

Deploy Request
    │
    ▼
┌───────────────────────────────┐
│ Parse Contract Code           │
│ Extract: className, baseClass │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ Check Registry for Base       │
│ Is 'BaseToken' registered?    │
└───────────┬───────────────────┘
            │
      ┌─────┴─────┐
      │           │
   Found      Not Found
      │           │
      ▼           ▼
┌──────────┐  ┌────────┐
│ Combine  │  │ Error  │
│ Code     │  │        │
└────┬─────┘  └────────┘
     │
     ▼
┌──────────────────────┐
│ Create Contract      │
│ Message              │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ Register Dependencies│
│ Hash → [BaseHash]    │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ Deploy to Store      │
└──────────────────────┘
```

## Storage Optimization

```
Before (No Inheritance)
═══════════════════════

Contract 1: 1000 lines ────┐
Contract 2: 1000 lines ────┼──> Total: 3000 lines stored
Contract 3: 1000 lines ────┘

After (With Inheritance)
════════════════════════

Base: 700 lines ────────────┐
Derived 1: 100 lines ───────┼──> Total: 1000 lines stored
Derived 2: 100 lines ───────┤    (70% reduction!)
Derived 3: 100 lines ───────┘
```

## API Call Flow

```
Simple Deployment
═════════════════

contract.deployContract(signer, code, params)
    │
    ├──> Parse contract code
    ├──> Check for base contracts in params
    ├──> Build combined contract if needed
    ├──> Create contract message
    ├──> Register dependencies
    └──> Deploy to storage


Derived Deployment
══════════════════

contract.deployDerivedContract(signer, code, 'BaseToken', params)
    │
    ├──> Verify base exists in registry
    ├──> Build contract with base
    ├──> Parse inheritance info
    ├──> Create contract message
    ├──> Register dependencies
    └──> Deploy to storage


Check Inheritance
═════════════════

contract.isDerivedFrom(DerivedClass, BaseClass)
    │
    ├──> Walk prototype chain
    ├──> Compare with base class
    └──> Return true/false
```

## Legend

```
┌─────────┐  Box           = Component/Module
└─────────┘

     │        Arrow        = Data flow / Relationship
     ▼

═════════    Double line   = Section header

─────────    Single line   = Subsection
```

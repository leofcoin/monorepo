import {
  validateGenesisPlan, buildGenesisContracts, parseGenesisAllocations, validateGenesisSupply,
  fingerprintGenesisPlan, type GenesisPlan
} from '@leofcoin/lib/genesis-plan'
import { nativeTokenMessage, contractFactoryMessage, validatorsMessage, nameServiceMessage } from '@leofcoin/lib'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { ContractMessage } from '@leofcoin/messages'
import { parseUnits } from '@leofcoin/utils'

/** Generate real public contract messages without touching a running chain or its stores. */
export async function generateGenesisBundle(input: GenesisPlan) {
  const plan = await validateGenesisPlan(input)
  const originals = {
    nativeToken: nativeTokenMessage, contractFactory: contractFactoryMessage,
    validators: validatorsMessage, nameService: nameServiceMessage
  }
  const sources = {
    nativeToken: new ContractMessage(originals.nativeToken).decoded.contract,
    contractFactory: new ContractMessage(originals.contractFactory).decoded.contract,
    validators: new ContractMessage(originals.validators).decoded.contract,
    nameService: new ContractMessage(originals.nameService).decoded.contract
  }
  const allocations = parseGenesisAllocations(JSON.stringify(plan.allocations), parseUnits)
  const { target, initial } = validateGenesisSupply(plan.targetSupply, plan.initialSupply, allocations, parseUnits)
  const { messages, contracts: addresses } = await buildGenesisContracts(plan.genesisValidator, target, initial, allocations, sources)
  const identity = await createChainIdentity(plan.network, addresses)
  if (identity.chainId !== plan.chainId) throw new Error('Generated genesis differs from the reviewed plan')
  const bytecodes = {
    nativeToken: await messages.nativeToken.toString(),
    contractFactory: await messages.contractFactory.toString(),
    validators: await messages.validators.toString(),
    nameService: await messages.nameService.toString()
  }
  return {
    schema: 'leofcoin:genesis-bundle:v1', plan,
    fingerprint: await fingerprintGenesisPlan(plan), identity, addresses, bytecodes
  }
}

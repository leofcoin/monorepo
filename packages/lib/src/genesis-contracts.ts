import { ContractMessage } from '@leofcoin/messages'
import type { GenesisContracts } from './chain-identity.js'
import dexSource from './dex-factory-source.json' with { type: 'json' }

export const dexFactorySource = new TextEncoder().encode(dexSource)

export type GenesisSources = Record<'nativeToken' | 'contractFactory' | 'validators' | 'nameService', Uint8Array> & { dexFactory?: Uint8Array }
export const GENESIS_REGISTRATION_FEE = (1000n * 10n ** 18n).toString()

/** The planner and generator must construct identical bytes, including links. */
export const buildGenesisContracts = async (
  creator: string, target: string, initial: string,
  allocations: Array<{ address: string; amount: string }>, sources: GenesisSources
) => {
  const message = (name: keyof GenesisSources, constructorParameters: any[]) => new ContractMessage({
    creator, contract: sources[name], constructorParameters
  })
  const nativeToken = message('nativeToken', [target, initial, [...allocations].sort((a,b) => a.address < b.address ? -1 : a.address > b.address ? 1 : 0)])
  const nativeHash = await nativeToken.hash()
  const contractFactory = message('contractFactory', [nativeHash, GENESIS_REGISTRATION_FEE])
  const validators = message('validators', [nativeHash])
  const nameService = message('nameService', [await contractFactory.hash(), nativeHash, await validators.hash(), GENESIS_REGISTRATION_FEE])
  const messages: Record<'contractFactory' | 'nativeToken' | 'nameService' | 'validators', ContractMessage> & { dexFactory?: ContractMessage } =
    { contractFactory, nativeToken, nameService, validators }
  if (sources.dexFactory) messages.dexFactory = message('dexFactory', [])
  const contracts = {} as GenesisContracts
  for (const name of Object.keys(messages) as Array<keyof typeof messages>) contracts[name] = await messages[name]!.hash()
  return { messages, contracts }
}

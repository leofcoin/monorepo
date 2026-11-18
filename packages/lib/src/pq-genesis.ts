import { ContractMessage } from '@leofcoin/messages'
import bytecodes from './bytecodes.json' with { type: 'json' }
import { buildGenesisContracts, dexFactorySource, type GenesisSources } from './genesis-contracts.js'
import { createChainIdentity, type GenesisContracts } from './chain-identity.js'
import { PQ_NETWORK, pqPublicKey } from './pq.js'

const names = ['contractFactory', 'nativeToken', 'nameService', 'validators'] as const
type Name = typeof names[number]
export type PqGenesis = Readonly<{
  schema: 'leofcoin:pq-genesis:v1'
  network: typeof PQ_NETWORK
  chainId: string
  addresses: Readonly<GenesisContracts>
  bytecodes: Readonly<Record<Name, string> & { dexFactory?: string }>
}>
const validated = new WeakSet<object>()

export function assertPqGenesis(value: unknown): asserts value is PqGenesis {
  if (!value || !validated.has(value as object)) throw new Error('PQ genesis must be built or validated locally')
}

/** Amounts are canonical integer base units, not decimal LFC. No secrets accepted. */
export async function createPqGenesis(input: {
  creator: string; target: string; initial: string; allocations: Array<{ address: string; amount: string }>
  dexFactory?: boolean
}): Promise<PqGenesis> {
  if (input.dexFactory !== undefined && typeof input.dexFactory !== 'boolean') throw new Error('dexFactory must be a boolean')
  pqPublicKey(input.creator)
  const amount = (value: string) => {
    if (typeof value !== 'string' || !/^[1-9]\d{0,77}$/.test(value)) throw new Error('Supply/allocation must be positive integer base units')
    return BigInt(value)
  }
  const target = amount(input.target), initial = amount(input.initial)
  if (initial > target || !Array.isArray(input.allocations) || !input.allocations.length ||
    input.allocations.length > 100) throw new Error('Invalid PQ genesis supply/allocations')
  const seen = new Set<string>()
  let total = 0n
  const allocations = input.allocations.map(({ address, amount: value }) => {
    pqPublicKey(address)
    if (seen.has(address)) throw new Error('Duplicate PQ genesis allocation')
    seen.add(address)
    total += amount(value)
    return { address, amount: value }
  })
  if (total !== initial || !seen.has(input.creator)) throw new Error('PQ genesis must allocate its initial supply and fund its creator')
  const sources = {} as GenesisSources
  for (const name of names) sources[name] = new ContractMessage(bytecodes[name]).decoded.contract
  if (input.dexFactory !== false) sources.dexFactory = dexFactorySource
  const built = await buildGenesisContracts(input.creator, input.target, input.initial, allocations, sources)
  const identity = await createChainIdentity(PQ_NETWORK, built.contracts)
  const encoded = {} as Record<Name, string> & { dexFactory?: string }
  for (const name of Object.keys(built.messages) as Array<keyof typeof encoded>) encoded[name] = built.messages[name]!.encoded.toString()
  const result: PqGenesis = Object.freeze({
    schema: 'leofcoin:pq-genesis:v1', network: PQ_NETWORK, chainId: identity.chainId,
    addresses: Object.freeze({ ...built.contracts }), bytecodes: Object.freeze(encoded)
  })
  validated.add(result)
  return result
}

/** Rebuild using reviewed bundled sources; never trust supplied executable code or cached hashes. */
export async function validatePqGenesis(value: PqGenesis): Promise<PqGenesis> {
  if (!value || value.schema !== 'leofcoin:pq-genesis:v1' || value.network !== PQ_NETWORK)
    throw new Error('Invalid PQ genesis bundle')
  if (JSON.stringify(value).length > 2 * 1024 * 1024) throw new Error('PQ genesis bundle is too large')
  const native = new ContractMessage(value.bytecodes.nativeToken).decoded
  const [target, initial, allocations] = native.constructorParameters
  if (Boolean(value.addresses.dexFactory) !== Boolean(value.bytecodes.dexFactory)) throw new Error('PQ genesis content/hash mismatch')
  const rebuilt = await createPqGenesis({ creator: native.creator, target: String(target), initial: String(initial), allocations,
    dexFactory: value.addresses.dexFactory !== undefined })
  if (value.chainId !== rebuilt.chainId ||
    [...names, 'dexFactory' as const].some(name => value.addresses[name] !== rebuilt.addresses[name] || value.bytecodes[name] !== rebuilt.bytecodes[name]))
    throw new Error('PQ genesis content/hash mismatch')
  return rebuilt
}

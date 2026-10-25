import MultiWallet from '@leofcoin/multi-wallet'
import { ContractMessage } from '@leofcoin/messages'
import bytecodes from './bytecodes.json' with { type: 'json' }
import { createChainIdentity, assertChainId } from './chain-identity.js'
import { buildGenesisContracts, type GenesisSources } from './genesis-contracts.js'
export { buildGenesisContracts } from './genesis-contracts.js'
import { parseGenesisAllocations, validateGenesisSupply } from './genesis-allocations.js'
export { parseGenesisAllocations, validateGenesisSupply } from './genesis-allocations.js'

export const GENESIS_PLAN_SCHEMA = 'leofcoin:genesis-plan'
export const GENESIS_PLAN_MAX_BYTES = 1_048_576
export const GENESIS_RUNTIME = Object.freeze({
  network: 'leofcoin:peach', networkVersion: 'peach', protocolVersion: '0.4.0',
  token: Object.freeze({ name: 'Leofcoin', symbol: 'LFC', decimals: 18 })
})
export type GenesisPlan = {
  schema: string; version: number; label: string; network: string; networkVersion: string; protocolVersion: string
  chainId: string
  token: { name: string; symbol: string; decimals: number }
  genesisValidator: string; targetSupply: string; initialSupply: string
  allocations: Array<{ address: string; amount: string }>; stars: string[]
}

function objectKeys(value: unknown, allowed: string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported ${label} field: ${key}. Never include secrets in a plan.`)
  }
}
const text = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value.trim()
}
const amount = (value: unknown, label: string) => {
  const decimal = text(value, label)
  if (!/^(0|[1-9]\d{0,59})(\.\d{1,18})?$/.test(decimal))
    throw new Error(`${label} must be a decimal string with at most 18 decimal places (no exponent or separators)`)
  const [whole, fraction = ''] = decimal.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}
const units = (value: string) => {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}
const publicAddress = (value: unknown, label: string) => {
  const address = text(value, label)
  if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(address)) throw new Error(`${label} must be a public Leofcoin address`)
  return address
}
const star = (value: unknown) => {
  const raw = text(value, 'Bootstrap endpoint')
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('Bootstrap endpoints must be valid wss:// URLs') }
  if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.search || url.hash)
    throw new Error('Bootstrap endpoints require wss:// and must not contain credentials, query strings or fragments')
  return url.href.replace(/\/$/, '')
}

/** Strict public data only: no identity, wallet or persistent-store access. */
export const normalizeGenesisPlan = (input: unknown): GenesisPlan => {
  objectKeys(input, ['schema', 'version', 'chainId', 'label', 'network', 'networkVersion', 'protocolVersion', 'token',
    'genesisValidator', 'targetSupply', 'initialSupply', 'allocations', 'stars'], 'plan')
  if (input.schema !== GENESIS_PLAN_SCHEMA || input.version !== 1) throw new Error('Unsupported genesis plan schema/version')
  const chainId = assertChainId(input.chainId)
  for (const key of ['network', 'networkVersion', 'protocolVersion'] as const) {
    if (input[key] !== GENESIS_RUNTIME[key]) throw new Error(`Unsupported ${key}; this runtime supports ${GENESIS_RUNTIME[key]}`)
  }
  objectKeys(input.token, ['name', 'symbol', 'decimals'], 'token')
  for (const key of ['name', 'symbol', 'decimals'] as const) {
    if (input.token[key] !== GENESIS_RUNTIME.token[key]) throw new Error('This runtime supports Leofcoin (LFC), 18 decimals only')
  }
  const label = text(input.label, 'Plan label')
  if (label.length > 80 || /[\u0000-\u001f\u007f]/.test(label)) throw new Error('Plan label must be at most 80 printable characters')
  const genesisValidator = publicAddress(input.genesisValidator, 'Genesis validator')
  const targetSupply = amount(input.targetSupply, 'Target supply')
  const initialSupply = amount(input.initialSupply, 'Initial supply')
  if (!Array.isArray(input.allocations) || !input.allocations.length || input.allocations.length > 1000)
    throw new Error('Provide between 1 and 1000 initial allocations')
  const allocations = input.allocations.map(entry => {
    objectKeys(entry, ['address', 'amount'], 'allocation')
    return { address: publicAddress(entry.address, 'Allocation address'), amount: amount(entry.amount, 'Allocation amount') }
  }).sort((left, right) => left.address < right.address ? -1 : left.address > right.address ? 1 : 0)
  validateGenesisSupply(targetSupply, initialSupply, parseGenesisAllocations(JSON.stringify(allocations), units), units)
  if (!allocations.some(entry => entry.address === genesisValidator))
    throw new Error('Allocate initial LFC to the genesis validator so it can distribute tokens and pay fees')
  if (!Array.isArray(input.stars) || input.stars.length > 16) throw new Error('Provide at most 16 bootstrap endpoints')
  const stars = [...new Set<string>(input.stars.map(star))].sort()
  return {
    schema: GENESIS_PLAN_SCHEMA, version: 1, chainId, label,
    ...GENESIS_RUNTIME, token: { ...GENESIS_RUNTIME.token }, genesisValidator,
    targetSupply, initialSupply, allocations, stars
  }
}

export const validateGenesisPlan = async (input: unknown): Promise<GenesisPlan> => {
  const plan = normalizeGenesisPlan(input)
  for (const address of new Set([plan.genesisValidator, ...plan.allocations.map(entry => entry.address)])) {
    try { await new MultiWallet(plan.network).fromAddress(address, null, plan.network) }
    catch { throw new Error(`Invalid public account checksum/key: ${address}`) }
  }
  if ((await deriveGenesisPlanIdentity(plan)).chainId !== plan.chainId)
    throw new Error('Chain ID does not match this genesis plan; regenerate the ID after changing genesis values')
  return plan
}

const deriveGenesisPlanIdentity = async (plan: GenesisPlan) => {
  const sources = {} as GenesisSources
  for (const name of Object.keys(bytecodes) as Array<keyof GenesisSources>)
    sources[name] = new ContractMessage(bytecodes[name]).decoded.contract
  const allocations = parseGenesisAllocations(JSON.stringify(plan.allocations), units)
  const { target, initial } = validateGenesisSupply(plan.targetSupply, plan.initialSupply, allocations, units)
  const { contracts } = await buildGenesisContracts(plan.genesisValidator, target, initial, allocations, sources)
  return createChainIdentity(plan.network, contracts)
}

/** Create an ID only from genesis contents. Imported IDs must instead be verified. */
export const createGenesisPlan = async (input: unknown): Promise<GenesisPlan> => {
  const plan = normalizeGenesisPlan({ ...(input as Record<string,unknown>), chainId: 'lfc:' + '0'.repeat(64) })
  const identity = await deriveGenesisPlanIdentity(plan)
  return validateGenesisPlan({ ...plan, chainId: identity.chainId })
}
export const parseGenesisPlan = (raw: string) => {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > GENESIS_PLAN_MAX_BYTES)
    throw new Error('Genesis plan exceeds the 1 MiB size limit')
  let value
  try { value = JSON.parse(raw) } catch { throw new Error('Genesis plan must be valid JSON') }
  return normalizeGenesisPlan(value)
}
export const serializeGenesisPlan = (plan: unknown) => JSON.stringify(normalizeGenesisPlan(plan), null, 2) + '\n'
/** Configuration fingerprint, deliberately not a genesis/block hash. */
export const fingerprintGenesisPlan = async (plan: unknown): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serializeGenesisPlan(plan)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

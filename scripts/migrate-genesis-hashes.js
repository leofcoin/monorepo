import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { ContractMessage } from '@leofcoin/messages'

const order = ['nativeToken', 'contractFactory', 'validators', 'nameService']

// Re-address the existing public contract artifacts. No wallets, passwords,
// stores, allocations, contract code, or owner identities are created or reset.
export const migrateGenesisHashes = async (addresses, bytecodes) => {
  for (const input of [addresses, bytecodes]) {
    if (Object.keys(input).length !== order.length || order.some((name) => typeof input[name] !== 'string' || !input[name])) {
      throw new Error('genesis artifacts must contain exactly the four native contracts')
    }
  }
  if (new Set(Object.values(addresses)).size !== order.length) throw new Error('genesis addresses must be unique')
  const replacements = new Map()
  const known = new Set(Object.values(addresses))
  const migratedAddresses = {}
  const migratedBytecodes = {}
  const replace = (value) => {
    if (typeof value === 'string' && known.has(value)) {
      if (!replacements.has(value)) throw new Error('unresolved genesis contract dependency')
      return replacements.get(value)
    }
    if (Array.isArray(value)) return value.map(replace)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]))
    return value
  }
  for (const name of order) {
    if (!addresses[name] || typeof bytecodes[name] !== 'string') throw new Error(`missing genesis contract: ${name}`)
    const previous = new ContractMessage(Uint8Array.from(bytecodes[name].split(',').map(Number)))
    const source = new TextDecoder().decode(previous.decoded.contract)
    if ([...known].some((address) => source.includes(address))) {
      throw new Error(`embedded genesis address in ${name}; explicit source migration required`)
    }
    const next = new ContractMessage({
      ...previous.decoded,
      constructorParameters: replace(previous.decoded.constructorParameters)
    })
    const hash = await next.hash()
    replacements.set(addresses[name], hash)
    migratedAddresses[name] = hash
    migratedBytecodes[name] = next.toString()
  }
  // Preserve artifact key order to keep generated diffs narrow.
  return {
    addresses: Object.fromEntries(Object.keys(addresses).map((name) => [name, migratedAddresses[name]])),
    bytecodes: Object.fromEntries(Object.keys(bytecodes).map((name) => [name, migratedBytecodes[name]]))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const addressFile = new URL('../packages/addresses/src/addresses.json', import.meta.url)
  const bytecodeFile = new URL('../packages/lib/src/bytecodes.json', import.meta.url)
  const addresses = JSON.parse(await readFile(addressFile, 'utf8'))
  const bytecodes = JSON.parse(await readFile(bytecodeFile, 'utf8'))
  const migrated = await migrateGenesisHashes(addresses, bytecodes)
  const changed = JSON.stringify(addresses) !== JSON.stringify(migrated.addresses) || JSON.stringify(bytecodes) !== JSON.stringify(migrated.bytecodes)
  if (changed && !process.argv.includes('--write')) throw new Error('genesis hash references need migration; review and run with --write')
  if (changed) {
    await writeFile(addressFile, JSON.stringify(migrated.addresses, null, '\t'))
    await writeFile(bytecodeFile, JSON.stringify(migrated.bytecodes, null, '\t'))
  }
  console.log(changed ? 'Genesis hash references migrated; owner, allocations and contract code preserved' : 'Genesis hash references are canonical and consistent')
}

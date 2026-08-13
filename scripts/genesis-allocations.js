export const parseGenesisAllocations = (raw, parseUnits) => {
  if (!raw) throw new Error('LFC_GENESIS_ALLOCATIONS is required')
  let allocations
  try {
    allocations = JSON.parse(raw)
  } catch {
    throw new Error('LFC_GENESIS_ALLOCATIONS must be valid JSON')
  }
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error('LFC_GENESIS_ALLOCATIONS must be a non-empty array')
  }
  const seen = new Set()
  return allocations
    .map(({ address, amount }) => {
      if (typeof address !== 'string' || !address || seen.has(address))
        throw new Error('invalid or duplicate genesis address')
      seen.add(address)
      const atomicAmount = BigInt(parseUnits(String(amount)))
      if (atomicAmount <= 0n) throw new Error('genesis allocation must be positive')
      return { address, amount: atomicAmount.toString() }
    })
    .sort((left, right) => left.address.localeCompare(right.address))
}

export const validateGenesisSupply = (targetSupply, initialSupply, allocations, parseUnits) => {
  const target = BigInt(parseUnits(String(targetSupply)))
  const initial = BigInt(parseUnits(String(initialSupply)))
  if (target <= 0n) throw new Error('target supply must be positive')
  if (initial <= 0n || initial > target) throw new Error('initial supply must be positive and not exceed target supply')
  const allocated = allocations.reduce((total, allocation) => total + BigInt(allocation.amount), 0n)
  if (allocated !== initial)
    throw new Error(`genesis allocations must equal initial supply: expected ${initial}, got ${allocated}`)
  return { target: target.toString(), initial: initial.toString() }
}

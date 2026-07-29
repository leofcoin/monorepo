export type ChainTip = { index?: number | bigint; hash?: string }

export const validateChainLink = (
  localTip: ChainTip | undefined,
  incoming: { index: number; hash: string; previousHash: string }
): 'append' | 'duplicate' | 'stale' => {
  const localHash = localTip?.hash || '0x0'
  const localIndex = Number(localTip?.index ?? -1)
  const hasCanonicalTip = localHash !== '0x0'

  if (hasCanonicalTip && incoming.index < localIndex) return 'stale'
  if (hasCanonicalTip && incoming.index === localIndex) {
    if (incoming.hash === localHash) return 'duplicate'
    throw new Error(`Block conflict detected at index ${incoming.index}`)
  }

  const expectedIndex = hasCanonicalTip ? localIndex + 1 : 0
  if (incoming.index !== expectedIndex) {
    throw new Error(`Unexpected block index ${incoming.index}; expected ${expectedIndex}`)
  }
  if (incoming.previousHash !== localHash) {
    throw new Error(
      `previousHash mismatch at index ${incoming.index}: expected ${localHash}, got ${incoming.previousHash}`
    )
  }

  return 'append'
}

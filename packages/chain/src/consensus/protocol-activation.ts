export const LEGACY_PROTOCOL_VERSION = '0.5.0'
export const PROTOCOL_ACTIVATION_HEIGHT = 14n

const heightOf = (index: number | bigint): bigint | undefined => {
  if (typeof index === 'bigint') return index >= 0n ? index : undefined
  return Number.isSafeInteger(index) && index >= 0 ? BigInt(index) : undefined
}

const majorMinor = (version: string): string | undefined => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.\d+$/.exec(version)
  return match ? `${match[1]}.${match[2]}` : undefined
}

export const usesConsecutiveNoncesAtHeight = (index: number | bigint): boolean => {
  const height = heightOf(index)
  return height === undefined || height >= PROTOCOL_ACTIVATION_HEIGHT
}

export const isBlockProtocolCompatibleAtHeight = (
  index: number | bigint,
  blockVersion: string,
  activeVersion: string
): boolean => {
  const height = heightOf(index)
  if (height === undefined) return false
  const expectedVersion = height !== undefined && height < PROTOCOL_ACTIVATION_HEIGHT
    ? LEGACY_PROTOCOL_VERSION
    : activeVersion
  const actual = majorMinor(blockVersion)
  const expected = majorMinor(expectedVersion)
  return actual !== undefined && expected !== undefined && actual === expected
}

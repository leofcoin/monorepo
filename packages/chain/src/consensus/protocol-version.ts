const majorMinor = (version: string): string | undefined => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
  return match ? `${match[1]}.${match[2]}` : undefined
}

export const isBlockProtocolCompatible = (blockVersion: string, activeVersion: string): boolean => {
  const actual = majorMinor(blockVersion)
  const expected = majorMinor(activeVersion)
  return actual !== undefined && expected !== undefined && actual === expected
}

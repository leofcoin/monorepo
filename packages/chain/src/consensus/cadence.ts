export interface ProposalCadence {
  now: number
  lastBlockTimestamp?: number
  lastProposalAt?: number
  blockTime: number
}

export const DEFAULT_BLOCK_TIME_MS = 6000

export const benchmarkBlockTime = (
  config: { network?: string; benchmarkBlockTimeMs?: number } = {},
  actualNetwork: string
): number => {
  const interval = config.benchmarkBlockTimeMs
  if (interval === undefined) return DEFAULT_BLOCK_TIME_MS
  if (config.network !== 'leofcoin:e2e' || actualNetwork !== 'leofcoin:e2e')
    throw new Error('Block timing overrides require the isolated leofcoin:e2e network')
  if (interval !== 1000 && interval !== DEFAULT_BLOCK_TIME_MS)
    throw new Error('Benchmark block time must be 1000 or 6000 ms')
  return interval
}

/** Chain heights are represented as numbers internally, even when wire-decoded as bigint. */
export const nextBlockIndex = (lastIndex: number | bigint | undefined): number => Number(lastIndex ?? -1) + 1

/** Return the delay required before another local block proposal is allowed. */
export const proposalDelay = ({
  now,
  lastBlockTimestamp = 0,
  lastProposalAt = 0,
  blockTime
}: ProposalCadence): number => {
  // A malformed future timestamp must not stall local block production beyond
  // one normal interval.
  const canonicalBase = Math.min(lastBlockTimestamp, now)
  const nextFromCanonicalBlock = canonicalBase > 0 ? canonicalBase + blockTime : 0
  const nextFromLocalAttempt = lastProposalAt > 0 ? lastProposalAt + blockTime : 0

  return Math.max(0, Math.max(nextFromCanonicalBlock, nextFromLocalAttempt) - now)
}

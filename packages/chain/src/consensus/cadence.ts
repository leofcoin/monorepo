export interface ProposalCadence {
  now: number
  lastBlockTimestamp?: number
  lastProposalAt?: number
  blockTime: number
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

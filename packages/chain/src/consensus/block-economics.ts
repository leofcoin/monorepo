type ValidatorReward = { address: string; reward: bigint }

export const validateCanonicalValidatorSet = (
  blockIndex: number | bigint,
  expectedValidators: string[],
  validators: ValidatorReward[]
): void => {
  const actualValidators = validators.map(({ address }) => address)
  const canonicalExpected = [...new Set(expectedValidators)].sort()

  if (
    actualValidators.length !== canonicalExpected.length ||
    actualValidators.some((address, index) => address !== canonicalExpected[index])
  ) {
    throw new Error(
      `Block ${blockIndex} validator set mismatch: expected ${canonicalExpected.join(',')}, got ${actualValidators.join(',')}`
    )
  }
}

export const validateBlockEconomics = (
  block: {
    index: number | bigint
    reward: bigint
    fees: bigint
    validators: ValidatorReward[]
  },
  calculatedFees: bigint,
  validatorFees: Map<string, bigint> = new Map(),
  subsidyRewards: Map<string, bigint> = new Map(),
  expectedSubsidy = [...subsidyRewards.values()].reduce((sum, reward) => sum + reward, 0n)
): void => {
  if (block.validators.length === 0) {
    throw new Error(`Block ${block.index} cannot distribute rewards without validators`)
  }
  if (block.reward !== expectedSubsidy) {
    throw new Error(`Block ${block.index} has invalid base reward: expected ${expectedSubsidy}, got ${block.reward}`)
  }
  if (block.fees !== calculatedFees) {
    throw new Error(`Block ${block.index} has invalid fees: expected ${calculatedFees}, got ${block.fees}`)
  }

  for (const validator of block.validators) {
    const expectedReward = (subsidyRewards.get(validator.address) || 0n) + (validatorFees.get(validator.address) || 0n)
    if (validator.reward !== expectedReward) {
      throw new Error(
        `Block ${block.index} has an invalid reward for validator ${validator.address}: ` +
          `expected ${expectedReward}, got ${validator.reward}`
      )
    }
  }
}

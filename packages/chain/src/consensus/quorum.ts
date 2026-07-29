export const quorumThreshold = (validatorCount: number): number => {
  if (!Number.isSafeInteger(validatorCount) || validatorCount < 1) {
    throw new Error('validator count must be a positive safe integer')
  }

  return Math.floor((2 * validatorCount) / 3) + 1
}

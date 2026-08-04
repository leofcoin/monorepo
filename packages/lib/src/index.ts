import bytecodes from './bytecodes.json' with { type: 'json' }
import { ContractMessage, TransactionMessage, RawTransactionMessage } from '@leofcoin/messages'
import { validators, contractFactory } from '@leofcoin/addresses'
export { default as nodeConfig } from './node-config.js'
import { formatUnits, parseUnits, toBigInt } from '@leofcoin/utils'
import { toBase58 } from '@vandeurenglenn/typed-array-utils'
import type { base58String } from '@vandeurenglenn/base58'

declare type address = string

declare type rawTransaction = {
  from: address
  to: address
  method: string
  params: any[]
  timestamp: number
}

declare type signedTransaction = {
  from: address
  to: address
  method: string
  params: any[]
  timestamp: number
  signature: base58String
}

declare type signable = {
  sign: (transaction: Uint8Array) => Uint8Array
}
export const contractFactoryMessage = bytecodes.contractFactory
export const nativeTokenMessage = bytecodes.nativeToken

export const nameServiceMessage = bytecodes.nameService
export const validatorsMessage = bytecodes.validators

export const TRANSACTION_FEE_BYTES = 1024n
export const TRANSACTION_FEE_UNIT = 10n
export const FEE_BURN_BASIS_POINTS = 1_000n
export const FEE_BASIS_POINTS = 10_000n
export const FEE_PROTOCOL_VERSION = '1.10.9'

const parseProtocolVersion = (version: string): [number, number, number] | undefined => {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

export const supportsTransactionFees = (version: string): boolean => {
  const actual = parseProtocolVersion(version)
  const required = parseProtocolVersion(FEE_PROTOCOL_VERSION)!
  if (!actual) return false
  for (let index = 0; index < required.length; index += 1) {
    if (actual[index] !== required[index]) return actual[index] > required[index]
  }
  return true
}

export type FeePayment = { to: string; amount: bigint }

const feeRotationIndex = (transactionHash: string, validatorCount: number): number => {
  let value = 0n
  for (const character of transactionHash) value = (value * 31n + BigInt(character.charCodeAt(0))) % 4_294_967_291n
  return Number(value % BigInt(validatorCount))
}

export const distributeTransactionFee = (
  fee: bigint,
  transactionHash: string,
  validatorAddresses: string[]
): { burned: bigint; validatorFees: Map<string, bigint>; payments: FeePayment[] } => {
  const canonicalValidators = [...new Set(validatorAddresses)].sort()
  if (canonicalValidators.length === 0) throw new Error('cannot distribute transaction fee without validators')
  if (fee < 0n) throw new Error('transaction fee cannot be negative')

  const burned = (fee * FEE_BURN_BASIS_POINTS) / FEE_BASIS_POINTS
  const validatorPool = fee - burned
  const count = BigInt(canonicalValidators.length)
  const base = validatorPool / count
  const remainder = Number(validatorPool % count)
  const start = feeRotationIndex(transactionHash, canonicalValidators.length)
  const validatorFees = new Map(canonicalValidators.map((validator) => [validator, base]))

  for (let index = 0; index < remainder; index += 1) {
    const validator = canonicalValidators[(start + index) % canonicalValidators.length]
    validatorFees.set(validator, validatorFees.get(validator)! + 1n)
  }

  const payments = [...validatorFees.entries()]
    .filter(([, amount]) => amount > 0n)
    .map(([to, amount]) => ({ to, amount }))
  return { burned, validatorFees, payments }
}

export const aggregateValidatorFees = (
  fees: Array<{ fee: bigint; transactionHash: string }>,
  validatorAddresses: string[]
): Map<string, bigint> => {
  const totals = new Map([...new Set(validatorAddresses)].sort().map((validator) => [validator, 0n]))
  for (const entry of fees) {
    const { validatorFees } = distributeTransactionFee(entry.fee, entry.transactionHash, validatorAddresses)
    for (const [validator, amount] of validatorFees) totals.set(validator, totals.get(validator)! + amount)
  }
  return totals
}

export const createContractMessage = async (creator, contract, constructorParameters = []) => {
  return new ContractMessage({
    creator,
    contract,
    constructorParameters
  })
}

export const calculateFee = async (transaction, format = false) => {
  transaction = await new TransactionMessage(transaction)
  const encodedBytes = BigInt(transaction.encoded.length)
  const units = (encodedBytes + TRANSACTION_FEE_BYTES - 1n) / TRANSACTION_FEE_BYTES
  const fee = units * TRANSACTION_FEE_UNIT

  return format ? formatUnits(fee.toString()) : fee
}

export const calculateTransactionFee = (transaction) => {
  transaction = new TransactionMessage(transaction)
  return calculateFee(transaction)
}

export const calculateReward = (validators, fees): [] => {
  validators = Object.keys(validators).reduce((set: object[], key) => {
    if (validators[key].active)
      set.push({
        address: key,
        reward: 0
      })
    return set
  }, [])

  return validators
}

export const createTransactionHash = async (
  transaction: rawTransaction | TransactionMessage | RawTransactionMessage
): Promise<Uint8Array> => {
  const isRawTransactionMessage = transaction instanceof RawTransactionMessage
  let message: RawTransactionMessage

  if (!isRawTransactionMessage)
    message = await new RawTransactionMessage(
      transaction instanceof TransactionMessage ? transaction.decoded : transaction
    )
  else message = transaction
  const hash = await message.peernetHash
  return (hash as typeof hash & { digest: Uint8Array }).digest
}

export const signTransaction = async (transaction: rawTransaction, wallet: signable): Promise<signedTransaction> => {
  const signature = toBase58(await wallet.sign(await createTransactionHash(transaction)))
  return { ...transaction, signature }
}

export const prepareContractTransaction = async (owner, contract, constructorParameters = []) => {
  const message = await createContractMessage(owner, contract, constructorParameters)
  const hash = await message.hash()

  const transaction: rawTransaction = {
    from: owner,
    to: contractFactory,
    timestamp: new Date().getTime(),
    method: 'registerContract',
    params: [hash]
  }

  return transaction
}

/**
 *
 * @param owner address
 * @param contract contract code
 * @param constructorParameters ...
 * @param wallet {sign}
 * @returns
 */
export const prepareContractTransactionAndSign = async (owner, contract, constructorParameters = [], wallet) => {
  const transaction = await prepareContractTransaction(owner, contract, constructorParameters)
  return signTransaction(transaction, wallet)
}

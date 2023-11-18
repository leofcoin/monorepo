import bytecodes from './bytecodes.json'
import { ContractMessage, TransactionMessage, RawTransactionMessage } from '@leofcoin/messages'
import { validators, contractFactory} from '@leofcoin/addresses'
export { default as nodeConfig} from './node-config.js'
import { BigNumber, formatUnits, parseUnits } from '@leofcoin/utils'
import { toBase58 } from '@vandeurenglenn/typed-array-utils'
import '@vandeurenglenn/base58'

declare type address = string

declare type rawTransaction = {
  from: address,
  to: address,
  method: string,
  params: any[],
  timestamp: Number
}

declare type signedTransaction = {
  from: address,
  to: address,
  method: string,
  params: any[],
  timestamp: Number,
  signature: base58String
}

declare type signable = {
  sign: (transaction: Uint8Array) => Uint8Array
}
export const contractFactoryMessage = bytecodes.contractFactory
export const nativeTokenMessage = bytecodes.nativeToken

export const nameServiceMessage = bytecodes.nameService
export const validatorsMessage = bytecodes.validators

export const createContractMessage = async (creator, contract, constructorParameters = []) => {
  return new ContractMessage({
    creator,
    contract,
    constructorParameters
  })
}

export const calculateFee = async (transaction, format = false) => {
  // excluded from fees
  if (transaction.to === validators) return 0
  transaction = await new TransactionMessage(transaction)
  let fee = parseUnits(String(transaction.encoded.length))
  
  // fee per gb
  fee = fee.div(1073741824)
  // fee = fee.div(1000000)
  
  return format ? formatUnits(fee.toString()) : fee
}

export const calculateTransactionFee = transaction => {
  transaction = new TransactionMessage(transaction)
  return calculateFee(transaction)
}

export const calculateReward = (validators, fees): [] => {
  validators = Object.keys(validators).reduce((set: object[], key) => {
    if (validators[key].active) set.push({
      address: key,
      reward: 0
    })
    return set

  }, [])

  return validators
}

export const createTransactionHash = async (transaction: rawTransaction | TransactionMessage | RawTransactionMessage): Promise<Uint8Array> => {
  const isRawTransactionMessage = transaction instanceof RawTransactionMessage
  let message: RawTransactionMessage

  if (!isRawTransactionMessage) message = await new RawTransactionMessage(
    transaction instanceof TransactionMessage ? transaction.decoded : transaction
  )
  else message = transaction
  return (await message.peernetHash).digest
}
  

export const signTransaction = async (transaction: rawTransaction, wallet: signable): Promise<signedTransaction> => {
  
  const signature = toBase58(await wallet.sign(await createTransactionHash(transaction)))
  return {...transaction, signature}
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
  
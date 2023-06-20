import bytecodes from './bytecodes.json' assert {type: 'json'}
import { ContractMessage, TransactionMessage, RawTransactionMessage } from '@leofcoin/messages'
import { validators, contractFactory} from '@leofcoin/addresses'
export { default as nodeConfig} from './node-config.js'
import { BigNumber, formatUnits, parseUnits } from '@leofcoin/utils'

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
  signature: Uint8Array
}

declare type signable = {
  sign: (transaction: rawTransaction) => Uint8Array
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

  if (!isRawTransactionMessage) {
    if (transaction.decoded && transaction instanceof TransactionMessage) transaction = await new RawTransactionMessage(transaction.decoded)
    else transaction = await new RawTransactionMessage(transaction)
  }
  
  return (await transaction.peernetHash).digest
}
  

export const signTransaction = async (transaction: rawTransaction, wallet: signable): Promise<signedTransaction> => {
  
  const signature = await wallet.sign(await createTransactionHash(transaction))
  const signedTransaction = {...transaction, signature}
  return signedTransaction
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
  
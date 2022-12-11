import bytecodes from './bytecodes.json' assert {type: 'json'}
import { ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { validators } from '@leofcoin/addresses'
import _nodeConfig from './node-config.js'
export const nodeConfig = _nodeConfig

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

export const calculateFee = async transaction => {
  // excluded from fees
  if (transaction.to === validators) return 0
  // fee per gb
  transaction = await new TransactionMessage(transaction)
  let fee = transaction.encoded.length
  fee = fee / 1024
  fee = fee / 1000000
  const parts = String(fee).split('.')
  let decimals = 0
  if (parts[1]) {
    const potentional = parts[1].split('e')
    parts[1] = potentional[0]
    decimals = Number(potentional[1].replace(/\-|\+/g, '')) + Number(potentional[0].length)
  }

  return Number.parseFloat(fee.toString()).toFixed(decimals)
}

export const calculateTransactionFee = transaction => {
  transaction = new TransactionMessage(transaction)
  return calculateFee(transaction)
}

export const calculateReward = (validators, fees) => {
  validators = Object.keys(validators).reduce((set, key) => {
    if (validators[key].active) set.push({
      address: key,
      reward: 0
    })

  }, [])
}

export { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
export { contractFactory, nativeToken, nameService, validators } from './addresses.json'
import bytecodes from './bytecodes.json'



export const contractFactoryMessage = new Uint8Array(bytecodes.contractFactory.split(','))
export const nativeTokenMessage = new Uint8Array(bytecodes.nativeToken.split(','))

export const nameServiceMessage = new Uint8Array(bytecodes.nameService.split(','))
export const validatorsMessage = new Uint8Array(bytecodes.validators.split(','))

export const calculateFee = transaction => {
  // excluded from fees
  if (transaction.decoded.to === validators) return 0
  // fee per gb
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

import ContractMessage from './messages/contract'
import TransactionMessage from './messages/transaction'
import BlockMessage from './messages/block'
import BWMessage from './messages/bw'
import BWRequestMessage from './messages/bw-request'
import bs58 from '@vandeurenglenn/base58'
import bytecodes from './bytecodes.json'
import addresses from './addresses.json'

const { contractFactory, nativeToken, nameService, validators } = addresses

const contractFactoryMessage = new Uint8Array(bytecodes.contractFactory.split(','))
const nativeTokenMessage = new Uint8Array(bytecodes.nativeToken.split(','))

const nameServiceMessage = new Uint8Array(bytecodes.nameService.split(','))
const validatorsMessage = new Uint8Array(bytecodes.validators.split(','))

const calculateFee = transaction => {
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

const calculateTransactionFee = transaction => {
  transaction = new TransactionMessage(transaction)
  return calculateFee(transaction)
}

const calculateReward = (validators, fees) => {
  validators = Object.keys(validators).reduce((set, key) => {
    if (validators[key].active) set.push({
      address: key,
      reward: 0
    })

  }, [])
}

export default {
  nativeToken,
  nameService,
  contractFactory,
  validators,
  contractFactoryMessage,
  nativeTokenMessage,
  nameServiceMessage,
  validatorsMessage,
  TransactionMessage,
  ContractMessage,
  BlockMessage,
  BWMessage,
  BWRequestMessage,
  calculateFee,
  calculateTransactionFee
}

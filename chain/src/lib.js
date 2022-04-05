import ContractMessage from './messages/contract'
import TransactionMessage from './messages/transaction'
import BlockMessage from './messages/block'
import BWMessage from './messages/bw'
import BWRequestMessage from './messages/bw-request'
import {formatUnits, parseUnits} from '@ethersproject/units'

const contractFactory = '5xdacidibzi36j2fom7rlygrehnw24743biu4plamvrrvd3p2ymllfson4'
const nativeToken = '5xdacihoqrspzpv6cgvj4mrdwhyslvmf2fqqj7tu6fvy7gj6zulmjttipq'
const nameService = '5xdacibncfrcwprbheboe7a7xqsh2mheokurmm7n6a3sgiuvclsfymqqxm'
const validators = '5xdacidxc5trwmpf2q6o7dozqyzc34yn7zxevwp6k5c5tk2azrdfx35awe'



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
  TransactionMessage,
  ContractMessage,
  BlockMessage,
  BWMessage,
  BWRequestMessage,
  calculateFee,
  calculateTransactionFee
}

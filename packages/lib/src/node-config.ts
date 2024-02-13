import {
  ContractMessage,
  TransactionMessage,
  BlockMessage,
  BWMessage,
  BWRequestMessage,
  ValidatorMessage,
  StateMessage
} from '@leofcoin/messages'
import Storage from '@leofcoin/storage'

declare global {
  var transactionPoolStore: Storage
  var stateStore: Storage
  var accountsStore: Storage
  var contractStore: Storage
}

export default async (
  config = {
    network: 'leofcoin:peach',
    networkVersion: 'v1.0.0'
  }
) => {
  await peernet.addProto('contract-message', ContractMessage)
  await peernet.addProto('transaction-message', TransactionMessage)
  await peernet.addProto('block-message', BlockMessage)
  await peernet.addProto('bw-message', BWMessage)
  await peernet.addProto('bw-request-message', BWRequestMessage)
  await peernet.addProto('validator-message', ValidatorMessage)
  await peernet.addProto('state-message', StateMessage)

  let name = `.${config.network}`
  const parts = config.network.split(':')
  if (parts[1]) name = `.${parts[0]}/${parts[1]}`
  await peernet.addStore('contract', 'lfc', name, false)
  await peernet.addStore('accounts', 'lfc', name, false)
  await peernet.addStore('transactionPool', 'lfc', name, false)
  await peernet.addStore('state', 'lfc', name, false)
  // private stores
  await peernet.addStore('wallet', 'lfc', name, true)
}

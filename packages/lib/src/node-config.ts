import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage, ValidatorMessage } from '@leofcoin/messages'
import Storage from '@leofcoin/storage'

declare global {
  var transactionPoolStore: Storage
  var accountsStore: Storage
  var contractStore: Storage
}

export default async (config = {
  network: 'leofcoin:peach',
  networkName: 'leofcoin:peach',
  networkVersion: 'v1.0.0'
}) => {
  await globalThis.peernet.addProto('contract-message', ContractMessage)
  await globalThis.peernet.addProto('transaction-message', TransactionMessage)
  await globalThis.peernet.addProto('block-message', BlockMessage)
  await globalThis.peernet.addProto('bw-message', BWMessage)
  await globalThis.peernet.addProto('bw-request-message', BWRequestMessage)
  await globalThis.peernet.addProto('validator-message', ValidatorMessage)
  
  let name = `.${config.network}`
  const parts = config.network.split(':')
  if (parts[1]) name = `.${parts[0]}/${parts[1]}`
  await globalThis.peernet.addStore('contract', 'lfc', name, false)
  await globalThis.peernet.addStore('accounts', 'lfc', name, false)
  await globalThis.peernet.addStore('transactionPool', 'lfc', name, false)
}
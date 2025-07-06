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
  const protos = [
    { name: 'transaction-message', handler: TransactionMessage },
    { name: 'contract-message', handler: ContractMessage },
    { name: 'block-message', handler: BlockMessage },
    { name: 'bw-message', handler: BWMessage },
    { name: 'bw-request-message', handler: BWRequestMessage },
    { name: 'validator-message', handler: ValidatorMessage },
    { name: 'state-message', handler: StateMessage }
  ]

  for (const proto of protos) {
    peernet.addProto(proto.name, proto.handler)
  }

  let name = `.${config.network}`
  const parts = config.network.split(':')
  if (parts[1]) name = `.${parts[0]}/${parts[1]}`
  const stores = ['transactionPool', 'state', 'accounts', 'contract', { name: 'wallet', private: true }]

  for (const store of stores) {
    if (typeof store === 'string') {
      await peernet.addStore(store, 'lfc', name, false)
    } else {
      await peernet.addStore(store.name, 'lfc', name, store.private)
    }
  }

  return {
    stores,
    protos
  }
}

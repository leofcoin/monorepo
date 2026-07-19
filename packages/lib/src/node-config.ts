import {
  ContractMessage,
  TransactionMessage,
  BlockMessage,
  BWMessage,
  BWRequestMessage,
  ValidatorMessage,
  StateMessage,
  LastBlockMessage
} from '@leofcoin/messages'
import Storage from '@leofcoin/storage'

declare global {
  var transactionPoolStore: Storage
  var stateStore: Storage
  var accountsStore: Storage
  var contractStore: Storage
  var walletStore: Storage
  var transactionStore: Storage
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
    { name: 'state-message', handler: StateMessage },
    { name: 'last-block', handler: LastBlockMessage }
  ]

  for (const proto of protos) {
    peernet.addProto(proto.name, proto.handler)
  }

  let name = (config as any).root || `.${config.network}`
  const parts = config.network.split(':')
  if (!(config as any).root && parts[1]) name = `.${parts[0]}/${parts[1]}`
  // optional namespace suffix to isolate multiple local nodes on same network
  // e.g., '.leofcoin/peach/dev-validator-1'
  if (
    !(config as any).root &&
    typeof (config as any).storeNamespace === 'string' &&
    (config as any).storeNamespace.length > 0
  ) {
    name = `${name}/${(config as any).storeNamespace}`
  }
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

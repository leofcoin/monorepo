import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage} from './../../messages/src/messages'

export default async (config = {
  network: 'leofcoin:mandarine',
  networkName: 'leofcoin:mandarine',
  networkVersion: 'v0.1.0'
}) => {
  await peernet.addProto('contract-message', ContractMessage)
  await peernet.addProto('transaction-message', TransactionMessage)
  await peernet.addProto('block-message', BlockMessage)
  await peernet.addProto('bw-message', BWMessage)
  await peernet.addProto('bw-request-message', BWRequestMessage)

  await peernet.addCodec('contract-message', {
    codec: parseInt('63636d', 16),
    hashAlg: 'keccak-256'
  })
  await peernet.addCodec('transaction-message', {
    codec: parseInt('746d', 16),
    hashAlg: 'keccak-256'
  })

  await peernet.addCodec('block-message', {
    codec: parseInt('626d', 16),
    hashAlg: 'keccak-256'
  })

  await peernet.addCodec('bw-message', {
    codec: parseInt('62776d', 16),
    hashAlg: 'keccak-256'
  })

  await peernet.addCodec('bw-request-message', {
    codec: parseInt('6277726d', 16),
    hashAlg: 'keccak-256'
  })
  let name = `.${config.network}`
  const parts = config.network.split(':')
  if (parts[1]) name = `.${parts[0]}/${parts[1]}`
  await peernet.addStore('contract', 'lfc', name, false)
  await peernet.addStore('accounts', 'lfc', name, false)
  await peernet.addStore('transactionPool', 'lfc', name, false)
}
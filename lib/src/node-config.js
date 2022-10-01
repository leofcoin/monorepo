import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage} from './../../messages/src/messages'

export default async () => {
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

  await peernet.addStore('contract', 'art', '.leofcoin', false)
  await peernet.addStore('accounts', 'art', '.leofcoin', false)
  await peernet.addStore('transactionPool', 'art', '.leofcoin', false)
}
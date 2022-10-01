import { TransactionMessage } from '../../../messages/src/messages'

globalThis.peernet = globalThis.peernet || {}
globalThis.contracts = {}
 

process.on('message', async (transactions) => {
  
globalThis.peernet.codecs =  {
  'contract-message': {
    codec: parseInt('63636d', 16),
    hashAlg: 'keccak-256'
  },
  'transaction-message': {
    codec: parseInt('746d', 16),
    hashAlg: 'keccak-256'
  },
  'block-message': {
    codec: parseInt('626d', 16),
    hashAlg: 'keccak-256'
  }
}
  transactions = await Promise.all(transactions.map(async message => new TransactionMessage(message)))

  process.send(transactions)
});
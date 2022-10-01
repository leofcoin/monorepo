import { TransactionMessage } from '../../messages/src/messages'

globalThis.peernet = globalThis.peernet || {}
globalThis.contracts = {}

const tasks = async transactions => {
  
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
  
  transactions = await Promise.all(transactions.map(async message => {
    message = await new TransactionMessage(message)
    
    return {...message.decoded, hash: await message.hash, size: message.encoded.length}
  }))

  globalThis.process ? process.send(transactions) : postMessage(transactions)
  
}

if (globalThis.process) {
  process.on('message', tasks)
} else {
  onmessage = message => tasks(message.data)
}

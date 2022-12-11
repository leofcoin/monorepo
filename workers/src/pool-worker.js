import { TransactionMessage } from '@leofcoin/messages'

import EasyWorker from '@vandeurenglenn/easy-worker'

globalThis.peernet = globalThis.peernet || {}
globalThis.contracts = {}

const worker = new EasyWorker()

const tasks = async transactions => {
  
  globalThis.peernet.codecs =  {
    'transaction-message': {
      codec: parseInt('746d', 16),
      hashAlg: 'keccak-256'
    }
  }
  
  transactions = await Promise.all(transactions.map(async message => {
    message = await new TransactionMessage(message)
    
    return {...message.decoded, hash: await message.hash(), size: message.encoded.length}
  }))

  worker.postMessage(transactions)
  
}
 worker.onmessage(data => tasks(data))

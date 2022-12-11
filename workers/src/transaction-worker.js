import { TransactionMessage } from '@leofcoin/messages'

globalThis.peernet = globalThis.peernet || {}
globalThis.contracts = {}

import EasyWorker from '@vandeurenglenn/easy-worker'

const worker = new EasyWorker()

worker.onmessage(async (transactions) => {  
  globalThis.peernet.codecs =  {
    'transaction-message': {
      codec: parseInt('746d', 16),
      hashAlg: 'keccak-256'
    }
  }
  transactions = await Promise.all(transactions.map(async message => new TransactionMessage(message)))

  worker.postMessage(transactions)
})
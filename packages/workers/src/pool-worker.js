import { TransactionMessage } from '@leofcoin/messages'

import EasyWorker from '@vandeurenglenn/easy-worker'
globalThis.contracts = {}

const worker = new EasyWorker()

const tasks = async transactions => {
  
  transactions = await Promise.all(transactions.map(async message => {
    message = await new TransactionMessage(message)
    
    return {...message.decoded, hash: await message.hash(), size: message.encoded.length}
  }))

  worker.postMessage(transactions)
  
}
 worker.onmessage(data => tasks(data))

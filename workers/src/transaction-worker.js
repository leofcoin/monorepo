import { TransactionMessage } from '@leofcoin/messages'
globalThis.contracts = {}

import EasyWorker from '@vandeurenglenn/easy-worker'

const worker = new EasyWorker()

worker.onmessage(async (transactions) => {
  transactions = await Promise.all(transactions.map(async message => new TransactionMessage(message)))

  worker.postMessage(transactions)
})
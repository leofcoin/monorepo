import { BlockMessage } from '@leofcoin/messages'
import { formatBytes, BigNumber } from '@leofcoin/utils'

import EasyWorker from '@vandeurenglenn/easy-worker'
import Storage from '@leofcoin/storage'
const worker = new EasyWorker()
const logStore = new Storage('log')
await logStore.init()

declare type messageType = 'put' | 'get'

declare type message = {
  type: messageType
  input: string
}

declare type messageReturn = {
  type: messageType
  result?: string
  message?: string
  error?: Error
}

const handlePut = async (message) => {
  try {
    await fetch(`http://localhost:8844/log/put`, {
      method: 'put',
      body: message
    })
  } catch (error) {
    worker.postMessage({ type: 'logError', message, error })
  }
}

const handleGet = async (message) => {
  try {
    await fetch(`http://localhost:8844/log/get?`, {
      method: 'put',
      body: message
    })
  } catch (error) {
    worker.postMessage({ type: 'logError', message, error })
  }
}

worker.onmessage((message: message) => {
  if (!message.type) message.type = 'put'
  if (message.type === 'put') handlePut(message.input)
  else handleGet(message.input)
})

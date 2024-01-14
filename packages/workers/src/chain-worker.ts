import { BlockMessage } from '@leofcoin/messages'
import { formatBytes, BigNumber } from '@leofcoin/utils'

import EasyWorker from '@vandeurenglenn/easy-worker'

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

const _addBlock = (block) => {
  blocks[block.index - 1] = block
}

const _getBlocks = (index = 0) => {
  worker.postMessage({ type: 'getBlock', result: blocks.slice(index - 1, blocks.length - 1) })
}

const _getBlock = (index) => {
  worker.postMessage({ type: 'getBlock', result: blocks[index - 1] })
}

const _init = (_blocks) => {
  blocks = _blocks
  try {
  } catch (error) {}
  worker.postMessage({ type: 'init', result: 'ready' })
}

worker.onmessage((message: message) => {
  if (!message.type) message.type = 'init'
  _[message.type](message.input)
})

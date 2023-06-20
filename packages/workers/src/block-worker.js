import { BlockMessage } from '@leofcoin/messages'
import { formatBytes, BigNumber } from '@leofcoin/utils'

import EasyWorker from '@vandeurenglenn/easy-worker'

const worker = new EasyWorker()

globalThis.BigNumber = BigNumber
globalThis.contracts = {}

const run = async (blocks) => {  
  blocks = await Promise.all(blocks.map(block => new BlockMessage(block)))
  blocks = blocks.sort((a, b) => a.decoded.timestamp - b.decoded.timestamp)

  blocks = await Promise.all(blocks.map(block => new Promise(async (resolve, reject) => {
    // todo: tx worker or nah?
    const size = block.encoded.length || block.encoded.byteLength
    console.log(`loaded block: ${await block.hash()} @${block.decoded.index} ${formatBytes(size)}`);
    resolve(block)
  })))
  return blocks
}

const tasks = async blocks => {  
  blocks = await run(blocks)
  worker.postMessage(blocks)
}
 

worker.onmessage(data => tasks(data))


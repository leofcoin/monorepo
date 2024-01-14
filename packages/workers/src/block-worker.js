import { BlockMessage } from '@leofcoin/messages'
import { formatBytes, BigNumber } from '@leofcoin/utils'

import EasyWorker from '@vandeurenglenn/easy-worker'

const worker = new EasyWorker()

globalThis.BigNumber = BigNumber
globalThis.contracts = {}

const run = async (blocks) => {
  blocks = await Promise.all(blocks.map((block) => new BlockMessage(block)))
  blocks = blocks.sort((a, b) => a.decoded.timestamp - b.decoded.timestamp)

  blocks = await Promise.all(
    blocks.map(
      (block) =>
        new Promise(async (resolve, reject) => {
          // todo: tx worker or nah?
          await block.encode()
          const size = block.encoded.length || block.encoded.byteLength
          const hash = await block.hash()
          const index = block.decoded.index
          resolve({ ...block.decoded, hash, blockInfo: { hash, size, index } })
        })
    )
  )
  return blocks
}

const tasks = async (blocks) => {
  blocks = await run(blocks)
  worker.postMessage(blocks)
}

worker.onmessage((data) => tasks(data))

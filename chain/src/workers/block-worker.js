import { BlockMessage, ContractMessage, TransactionMessage } from '../../../messages/src/messages'
import { formatBytes, BigNumber } from '../../../utils/src/utils'
import bytecodes  from '../../../lib/src/bytecodes.json'
import { fork } from 'child_process'

const contractFactoryMessage = bytecodes.contractFactory
const nativeTokenMessage = bytecodes.nativeToken
const nameServiceMessage = bytecodes.nameService
const validatorsMessage = bytecodes.validators

globalThis.BigNumber = BigNumber

globalThis.peernet = globalThis.peernet || {}
globalThis.contracts = {}

const run = async (blocks) => {  
  blocks = await Promise.all(blocks.map(block => new BlockMessage(block)))
  blocks = blocks.sort((a, b) => a.decoded.timestamp - b.decoded.timestamp)

  blocks = await Promise.all(blocks.map(block => new Promise(async (resolve, reject) => {
    block.decoded.transactions = await Promise.all(
      block.decoded.transactions
        .map(async message => new TransactionMessage(message))
    )
    const size = block.encoded.length || block.encoded.byteLength
    console.log(`loaded block: ${await block.hash} @${block.decoded.index} ${formatBytes(size)}`);
    return block
  })))
  return blocks
}

const tasks = async blocks => {
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
  
  blocks = await run(blocks)
  globalThis.process ? process.send(blocks) : postMessage(blocks)
}
 
if (globalThis.process) {
  process.on('message', tasks)
} else {
  onmessage = message => tasks(message.data)
}

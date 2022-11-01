import { BlockMessage, ContractMessage, TransactionMessage } from './../../../messages/src/messages'
import { formatBytes, BigNumber } from './../../../utils/src/utils'
import bytecodes  from './../../../lib/src/bytecodes.json'
import { fork } from 'child_process'
import { join } from 'path'
const contractFactoryMessage = bytecodes.contractFactory
const nativeTokenMessage = bytecodes.nativeToken
const nameServiceMessage = bytecodes.nameService
const validatorsMessage = bytecodes.validators

globalThis.BigNumber = BigNumber

globalThis.peernet = globalThis.peernet || {}
globalThis.contracts = {}


const get = (contract, method, params) => {
  let result
  if (params?.length > 0) {
    result = contracts[contract][method](...params)
  } else {
    result = contracts[contract][method]
  }
  return result
}

const runContract = async (contractMessage) => {
  const params = contractMessage.decoded.constructorParameters
  try {

    const func = new Function(contractMessage.decoded.contract)
    const Contract = func()

    globalThis.msg = createMessage(contractMessage.decoded.creator)
    // globalThis.msg = {sender: contractMessage.decoded.creator}
    contracts[await contractMessage.hash] = await new Contract(...params)
    process.send({
      type: 'debug',
      messages: [
        `loaded contract: ${await contractMessage.hash}`,
        `size: ${formatBytes(contractMessage.encoded.length)}`
      ]
    })
  } catch (e) {
    console.log(e);
    process.send({
      type: 'contractError',
      hash: await contractMessage.hash
    })
  }
}

const execute = async (contract, method, params) => {
  try {
    let result
    // don't execute the method on a proxy
    if (contracts[contract].fallback) {
      result = await contracts[contract].fallback(method, params)
    } else {
      result = await contracts[contract][method](...params)
    }

    // state.put(result)
    return result
  } catch (e) {
    throw e
  }
}


const createMessage = (sender = globalThis.peerid) => {
  return {
    sender,
    call: execute,
    staticCall: get
  }
}

const _init = async ({ contracts, blocks, peerid })=> {
  
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

  globalThis.peerid = peerid
  contracts = [
    contractFactoryMessage,
    nativeTokenMessage,
    nameServiceMessage,
    validatorsMessage
  ]

  contracts = await Promise.all(contracts.map(async contract => {
    contract = await new ContractMessage(new Uint8Array(contract.split(',')))
    await runContract(contract)
    return contract
  }))

  const worker = fork(join(__dirname, './block-worker.js'), {serialization: 'advanced'})
  // worker.on('message')
    worker.once('message', async (blocks) => {
      console.log({blocks});
      for (const block of blocks) {
        await Promise.all(block.decoded.transactions.map(async message => {
          const {from, to, method, params} = message
          globalThis.msg = createMessage(from)
        
          await execute(to, method, params)
        }))
      }
      let lastBlock
      if (blocks.length > 0) {
        lastBlock = blocks[blocks.length - 1].decoded
     
        lastBlock = await new BlockMessage(lastBlock)
        lastBlock = {
          ...lastBlock.decoded,
          hash: await lastBlock.hash
        }
      }
      process.send({type: 'machine-ready', lastBlock })
      worker.kill() 
        

      
    })
    worker.send(blocks)
}

const tasks = async (e) => {
  const id = e.id
    if (e.type === 'init') await _init(e.input)
    if (e.type === 'get') {
      const value = await get(e.input.contract, e.input.method, e.input.params)
      process.send({
        type: 'response',
        id,
        value
      })
    }
    if (e.type === 'execute') {
      try {
        const value = await execute(e.input.contract, e.input.method, e.input.params)
        process.send({
          type: 'response',
          id,
          value
        })
      } catch(e) {
        process.send({
          type: 'executionError',
          message: e.message,
          id
          
        })
      }
    }
  }


if (globalThis.process) {
  process.on('message', tasks)
} else {
  onmessage = message => tasks(message.data)
}
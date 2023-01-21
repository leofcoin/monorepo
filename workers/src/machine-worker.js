import { BlockMessage, ContractMessage } from '@leofcoin/messages'
import { formatBytes, BigNumber } from '@leofcoin/utils'
import bytecodes  from '@leofcoin/lib/bytecodes' assert {type: 'json'}
import EasyWorker from '@vandeurenglenn/easy-worker'
const worker = new EasyWorker()

const contractFactoryMessage = bytecodes.contractFactory
const nativeTokenMessage = bytecodes.nativeToken
const nameServiceMessage = bytecodes.nameService
const validatorsMessage = bytecodes.validators

globalThis.BigNumber = BigNumber
globalThis.contracts = {}

const unique = arr => arr.filter((el, pos, arr) => {
  return arr.indexOf(el) == pos;
})

const has = address => {
  return contracts[address] ? true : false
}

const get = (contract, method, params) => {
  let result
  if (params?.length > 0) {
    result = contracts[contract][method](...params)
  } else {
    result = contracts[contract][method]
  }
  return result
}

const runContract = async ({decoded, hash, encoded}) => {
  const params = decoded.constructorParameters
  try {

    const func = new Function(new TextDecoder().decode(decoded.contract))
    const Contract = func()

    globalThis.msg = createMessage(decoded.creator)
    contracts[hash] = await new Contract(...params)
    worker.postMessage({
      type: 'debug',
      messages: [
        `loaded contract: ${hash}`,
        `size: ${formatBytes(encoded.length)}`
      ]
    })
  } catch (e) {
    console.log(e);
    worker.postMessage({
      type: 'contractError',
      hash: await contractMessage.hash()
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

  globalThis.peerid = peerid
  contracts = [
    contractFactoryMessage,
    nativeTokenMessage,
    nameServiceMessage,
    validatorsMessage
  ]

  contracts = await Promise.all(contracts.map(async contract => {
    contract = await new ContractMessage(new Uint8Array(contract.split(',')))
    await runContract({decoded: contract.decoded, encoded: contract.encoded, hash: await contract.hash()})
    return contract
  }))

  let lastBlock = {hash: '0x0'}; 

  if (blocks?.length > 0) {
    const _worker = await new EasyWorker('node_modules/@leofcoin/workers/src/block-worker.js', {serialization: 'advanced', type: 'module' })
    blocks = await _worker.once([blocks[blocks.length - 1]])
    
    // blocks = unique(globalThis.blocks ? globalThis : [], blocks)
    // for (let i = 0; i < blocks.length; i++) {

    // }
    // for (const block of blocks) {
    //   await Promise.all(block.decoded.transactions.map(async message => {
    //     if (!block.loaded) {
    //       const {from, to, method, params} = message;
    //       globalThis.msg = createMessage(from);
        
    //       await execute(to, method, params);
    //       block.loaded = true
    //     }
    //   }));
    // }
    
    if (blocks.length > 0) {
      lastBlock = blocks[blocks.length - 1].decoded;    
      lastBlock = await new BlockMessage(lastBlock);
  
      lastBlock = {
        ...lastBlock.decoded,
        hash: await lastBlock.hash()
      };
    }
    globalThis.blocks = blocks
  }

  

  
  worker.postMessage({type: 'machine-ready', lastBlock});
  
  // worker.postMessage({blocks});
}

const tasks = async (e) => {
  const id = e.id
    if (e.type === 'init') {
      try {
        await _init(e.input)
      } catch (e) {
        worker.postMessage({
          type: 'initError',
          message: e.message,
          id          
        })
      }
    }
    if (e.type === 'has') {
      try {
        const value = await has(e.input.address)
        worker.postMessage({
          type: 'response',
          id,
          value
        })
      } catch (error) {
        worker.postMessage({
          type: 'hasError',
          message: error.message,
          id          
        })
      }
    }
    if (e.type === 'run') {
      try {
        const value = await runContract(e.input)
        worker.postMessage({
          type: 'response',
          id,
          value
        })
      } catch (e) {
        worker.postMessage({
          type: 'runError',
          message: e.message,
          id          
        })
      }
    }
    if (e.type === 'get') {
      try {
        const value = await get(e.input.contract, e.input.method, e.input.params)
        worker.postMessage({
          type: 'response',
          id,
          value
        })
      } catch (e) {
        worker.postMessage({
          type: 'fetchError',
          message: e.message,
          id          
        })
      }
      
    }
    if (e.type === 'execute') {
      try {
        const value = await execute(e.input.contract, e.input.method, e.input.params)
        worker.postMessage({
          type: 'response',
          id,
          value
        })
      } catch(e) {
        worker.postMessage({
          type: 'executionError',
          message: e.message,
          id
          
        })
      }
    }
  }

worker.onmessage(data => tasks(data))
import { BlockMessage, ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { formatBytes, BigNumber } from '@leofcoin/utils'
import addresses from '@leofcoin/addresses'
import bytecodes from '@leofcoin/lib/bytecodes' assert { type: 'json' }
import EasyWorker from '@vandeurenglenn/easy-worker'
import { nativeToken } from '@leofcoin/addresses'
import LittlePubSub from '@vandeurenglenn/little-pubsub'
const pubsub = new LittlePubSub()
const worker = new EasyWorker()

const contractFactoryMessage = bytecodes.contractFactory
const nativeTokenMessage = bytecodes.nativeToken
const nameServiceMessage = bytecodes.nameService
const validatorsMessage = bytecodes.validators

const latestTransactions = []
let nativeCalls = 0
let nativeBurns = 0
let nativeMints = 0
let nativeTransfers = 0
let totalTransactions = 0

let totalBurnAmount = 0
let totalMintAmount = 0
let totalTransferAmount = 0

let blocks = []
let contracts = {}
const _ = {}

globalThis.BigNumber = BigNumber

let lastBlock = { index: -1, hash: '0x0', previousHash: '0x0' }

const debug = (message) => {
  worker.postMessage({
    type: 'debug',
    message
  })
}

const unique = (arr) =>
  arr.filter((el, pos, arr) => {
    return arr.indexOf(el) == pos
  })

const has = (address) => {
  return contracts[address] ? true : false
}

const get = ({ contract, method, params }) => {
  let result
  if (params?.length > 0) {
    result = contracts[contract][method](...params)
  } else {
    result = contracts[contract][method]
  }
  return result
}

const resolveContract = (address) => askFor('contract', address)

const respond = (id, value) => {
  worker.postMessage({
    type: 'response',
    value,
    id
  })
}

_.runContract = async ({ decoded, hash, encoded }, state) => {
  const params = decoded.constructorParameters
  try {
    const func = new Function(new TextDecoder().decode(decoded.contract))
    const Contract = func()

    if (state) params.push(state)

    globalThis.msg = createMessage(decoded.creator, hash)
    contracts[hash] = await new Contract(...params)

    debug(`loaded contract: ${hash} size: ${formatBytes(encoded.length)}`)
  } catch (e) {
    console.log(e)
    worker.postMessage({
      type: 'contractError',
      message: e.message,
      hash
    })
  }
}

_.execute = async ({ contract, method, params }) => {
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
    console.log({ e })
    throw new Error(
      `error: ${e.message}
      contract: ${contract}
      method: ${method}
      params: ${JSON.stringify(params, null, '\t')}
      `
    )
  }
}

const createMessage = (sender = globalThis.peerid, contract) => {
  return {
    contract,
    sender,
    call: _.execute,
    staticCall: get
  }
}

const _executeTransaction = async (transaction) => {
  const hash = await new TransactionMessage(transaction).hash()
  if (latestTransactions.includes(hash)) {
    throw new Error(`double transaction found: ${hash} in block ${block.index}`)
  } else {
    latestTransactions.push(hash)
    const { from, to, method, params, nonce } = transaction
    globalThis.msg = createMessage(from)

    await _.execute({ contract: to, method, params })
    if (to === nativeToken) {
      nativeCalls += 1
      if (method === 'burn') nativeBurns += 1
      if (method === 'mint') nativeMints += 1
      if (method === 'transfer') nativeTransfers += 1
    }
    totalTransactions += 1

    worker.postMessage({
      type: 'transactionLoaded',
      result: {
        hash,
        from,
        nonce: String(nonce)
      }
    })
  }
}

_.init = async (message) => {
  let { peerid, fromState, state } = message
  globalThis.peerid = peerid
  console.log({ fromState })
  if (fromState) {
    lastBlock = message.lastBlock
    const setState = async (address, state) => {
      const contractBytes = await resolveContract(address)
      const contract = await new ContractMessage(contractBytes)

      await _.runContract({ hash: address, decoded: contract.decoded, encoded: contract.encoded }, state)
    }

    const entries = Object.entries(state)
    if (entries.length > 0) {
      const promises = []
      for (const [address, value] of entries) {
        promises.push(setState(address, value))
      }
      await Promise.all(promises)
    }

    const promises = []
    if (!contracts[addresses.contractFactory]) promises.push(setState(addresses.contractFactory))
    if (!contracts[addresses.nameService]) promises.push(setState(addresses.nameService))
    if (!contracts[addresses.validators]) promises.push(setState(addresses.validators))
    if (!contracts[addresses.nativeToken]) promises.push(setState(addresses.nativeToken))
    // contracts = await Promise.all(
    //   contracts.map(async (contract) => {
    //     contract = await new ContractMessage(new Uint8Array(contract.split(',')))
    //     await _.runContract({ decoded: contract.decoded, encoded: contract.encoded, hash: await contract.hash() })
    //     return contract
    //   })
    // )
    await Promise.all(promises)
  } else {
    await Promise.all(
      [contractFactoryMessage, nativeTokenMessage, nameServiceMessage, validatorsMessage].map(async (contract) => {
        contract = await new ContractMessage(new Uint8Array(contract.split(',')))
        return _.runContract({ decoded: contract.decoded, encoded: contract.encoded, hash: await contract.hash() })
      })
    )
    console.log({ blocks: message.blocks })
    if (message.blocks?.length > 0) {
      let pre

      try {
        const importee = await import('url')
        const url = importee.default
        if (url) pre = url.fileURLToPath(new URL('.', import.meta.url))
      } catch {
        // browser env
        pre = './'
      }

      let _worker = await new EasyWorker(pre + '@leofcoin/workers/block-worker.js', {
        serialization: 'advanced',
        type: 'module'
      })
      blocks = await _worker.once(message.blocks)
      _worker = null
      // blocks = unique(globalThis.blocks ? globalThis : [], blocks)
      // for (let i = 0; i < blocks.length; i++) {

      // }
      for (const block of blocks) {
        // we only revalidate the latest 24 blocks
        // every 24 blocks a snapshot is taken and stored in state
        // this means contracts will be restored from this state
        // this also means devs NEED to make sure the state can be restored
        // on contract deploy an error will be thrown if state wasn't recoverable
        if (block.index > 24) {
          const transactionCount = blocks[block.index - 1].transactions.length
          latestTransactions.splice(-(transactionCount - 1), latestTransactions.length)
        }

        if (!block.loaded && !fromState) {
          const priority = block.transactions.filter((transaction) => transaction.priority)
          if (priority.length > 0)
            await Promise.all(
              priority.sort((a, b) => a.nonce - b.nonce).map((transaction) => _executeTransaction(transaction))
            )

          await Promise.all(
            block.transactions
              .filter((transaction) => !transaction.priority)
              .map(async (transaction) => _executeTransaction(transaction))
          )
        }
        block.loaded = true
        worker.postMessage({
          type: 'debug',
          message: `loaded transactions for block: ${block.blockInfo.hash} @${block.blockInfo.index} ${formatBytes(
            block.blockInfo.size
          )}`
        })
      }

      if (blocks.length > 0) {
        lastBlock = blocks[blocks.length - 1]
      }
      globalThis.blocks = blocks
    }
  }

  worker.postMessage({ type: 'machine-ready', lastBlock })

  // worker.postMessage({blocks});
}

_.addLoadedBlock = (block) => {
  blocks[block.index - 1] = block
  lastBlock = blocks[blocks.length - 1]
  return true
}

_.loadBlock = (block) => {
  // todo validate here and deprecate addLoadedBlock
}

const askFor = (question, input) =>
  new Promise((resolve) => {
    const id = globalThis.crypto.randomUUID()
    pubsub.subscribe(id, resolve)
    worker.postMessage({
      type: 'ask',
      question,
      input,
      id
    })
  })

const runTask = async (id, taskName, input) => {
  try {
    const result = await _[taskName](input)
    respond(id, result)
  } catch (e) {
    worker.postMessage({
      type: `${taskName}Error`,
      message: e.message,
      id
    })
  }
}

worker.onmessage(({ id, type, input }) => {
  if (pubsub.hasSubscribers(id)) {
    pubsub.publish(id, input)
    return
  }
  switch (type) {
    case 'init':
      runTask(id, 'init', input)
      break
    case 'run':
      runTask(id, 'runContract', input)
      break
    case 'execute':
      runTask(id, 'execute', input)
      break
    case 'addLoadedBlock':
      runTask(id, 'addLoadedBlock', input)
      break
    case 'nativeCalls':
      respond(id, nativeCalls)
      break
    case 'contracts':
      respond(id, contracts)
      break
    case 'nativeMints':
      respond(id, nativeMints)
      break
    case 'nativeBurns':
      respond(id, nativeBurns)
      break
    case 'nativeTransfers':
      respond(id, nativeTransfers)
      break
    case 'totalTransfers':
      respond(id, totalTransfers)
      break
    case 'totalBlocks':
      respond(id, blocks.length)
      break
    case 'blocks':
      respond(id, input ? blocks.slice(input.from, input.to) : blocks)
      break
    case 'block':
      respond(id, blocks[input - 1])
      break
    case 'lastBlock':
      respond(id, lastBlock)
      break
    case 'latestTransactions':
      respond(id, latestTransactions)
      break
    case 'totalTransactions':
      respond(id, totalTransactions)
      break
    case 'has':
      respond(id, has(input.address))
      break
    case 'get':
      respond(id, get(input))
      break
    default:
      console.log(`machine-worker: unsupported taskType: ${type}`)
      break
  }
})

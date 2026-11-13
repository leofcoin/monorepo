import { encodeValue } from '@leofcoin/binary'
import { ContractMessage } from '@leofcoin/messages'
import { formatBytes, jsonParseBigInt, jsonStringifyBigInt } from '@leofcoin/utils'
import addresses from '@leofcoin/addresses'
import bytecodes from '@leofcoin/lib/bytecodes.json' assert { type: 'json' }
import { MONETARY_POLICY_AUTHORITY, MAX_BLOCK_TRANSACTIONS } from '@leofcoin/lib'
import EasyWorker from './binary-worker.js'
import { nativeToken } from '@leofcoin/addresses'
import LittlePubSub from '@vandeurenglenn/little-pubsub'
import { DEFAULT_CONTRACT_EXECUTION_UNITS, ExecutionMeter, instrumentContractSource } from './execution-meter.js'
import { createCryptoBridge, DeterministicCrypto } from './deterministic-crypto.js'

const pubsub = new LittlePubSub()
const worker = new EasyWorker()

const contractFactoryMessage = bytecodes.contractFactory
const nativeTokenMessage = bytecodes.nativeToken
const nameServiceMessage = bytecodes.nameService
const validatorsMessage = bytecodes.validators

const latestTransactions = []

let nativeCalls: bigint
let nativeBurns: bigint
let nativeMints: bigint
let nativeTransfers: bigint
let totalTransactions: bigint

let totalBurnAmount: bigint
let totalMintAmount: bigint
let totalTransferAmount: bigint
let totalBlocks: bigint

let blocks = []
let contracts = {}
let contractDefinitions = {}
const readCodeCache = new Map<string, { decoded: any; encoded: Uint8Array; source: string; size: number }>()
let readCodeBytes = 0
let readOnly = false
let readBaseline
const stateFingerprint = value => JSON.stringify(value, (_, item) => {
  if (typeof item === 'bigint') return { $bigint: item.toString() }
  if (item && typeof item === 'object' && !Array.isArray(item))
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
  return item
})

let activeMeter: ExecutionMeter
let activeTimestamp: number
let activeCrypto: DeterministicCrypto
let activeExecution: {
  counters: {
    nativeBurns: bigint
    nativeCalls: bigint
    nativeMints: bigint
    nativeTransfers: bigint
    totalBurnAmount: bigint
    totalMintAmount: bigint
    totalTransactions: bigint
    totalTransferAmount: bigint
  }
  deployed: Set<string>
  snapshots: Map<string, any>
  seed: string
  timestamp: number
  randomness?: string
}

const meterBridge = Object.freeze({
  tick: (units = 1) => {
    if (!activeMeter) throw new Error('contract executed outside deterministic execution context')
    activeMeter.tick(units)
  }
})
const dateBridge = Object.freeze({ now: () => activeTimestamp })
const cryptoBridge = createCryptoBridge(() => activeCrypto)

let lastBlock = { index: -1, hash: '0x0', previousHash: '0x0' }

const createMessage = (sender = globalThis.peerid, contract) => {
  return {
    contract,
    sender,
    call: async (targetOrParams, method?, params = []) => {
      if (readOnly) throw new Error('Read-only contract queries cannot call mutating contracts')
      const callParams =
        typeof targetOrParams === 'object'
          ? targetOrParams
          : { contract: targetOrParams, method, params }
      // make sure sender is set to the actual caller (iow contracts need approval to access tokens ...)
      const previousMessage = globalThis.msg
      globalThis.msg = createMessage(contract, callParams.contract)
      try {
        return await _.execute(callParams)
      } finally {
        globalThis.msg = previousMessage
      }
    },
    staticCall: async (target, method, params = []) => {
      if (!readOnly) return askFor('staticCall', { snapshot: await _.snapshot(), contract: target, method, params, sender: contract })
      const previousMessage = globalThis.msg
      globalThis.msg = createMessage(contract, target)
      try {
        return await get({ contract: target, method, params })
      } finally {
        globalThis.msg = previousMessage
      }
    }
  }
}

const createState = async () => ({
  peers: await askFor('peers'),
  lastBlock
})

const debug = (message) => {
  if (readOnly) return
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

const beginExecution = (seed: string, timestamp = Number(lastBlock.timestamp ?? 0), randomness?: string) => {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('invalid deterministic execution timestamp')
  activeMeter = new ExecutionMeter(DEFAULT_CONTRACT_EXECUTION_UNITS)
  activeTimestamp = timestamp
  activeCrypto = randomness ? new DeterministicCrypto(`${randomness}:${seed}`) : undefined
}

const cloneState = (value) => structuredClone(value)

const snapshotCounters = () => ({
  nativeBurns,
  nativeCalls,
  nativeMints,
  nativeTransfers,
  totalBurnAmount,
  totalMintAmount,
  totalTransactions,
  totalTransferAmount
})

const instantiateContract = async (hash: string, state?) => {
  const definition = contractDefinitions[hash]
  if (!definition) throw new Error(`missing contract definition for ${hash}`)
  const params = cloneState(definition.constructorParameters)
  if (state !== undefined) params.push(cloneState(state))
  globalThis.msg = createMessage(definition.creator, hash)
  globalThis.state = await createState()
  contracts[hash] = await new definition.Contract(...params)
  return contracts[hash]
}

const snapshotContract = (contract: string) => {
  if (!activeExecution || activeExecution.snapshots.has(contract)) return
  if (!contracts[contract]) throw new Error(`contract ${contract} is not loaded`)
  activeExecution.snapshots.set(contract, cloneState(contracts[contract].state))
}

const rollbackExecution = async () => {
  const snapshots = [...activeExecution.snapshots.entries()]
  for (const contract of activeExecution.deployed) {
    delete contracts[contract]
    delete contractDefinitions[contract]
  }
  ;({
    nativeBurns,
    nativeCalls,
    nativeMints,
    nativeTransfers,
    totalBurnAmount,
    totalMintAmount,
    totalTransactions,
    totalTransferAmount
  } = activeExecution.counters)
  beginExecution(`rollback:${activeExecution.seed}`, activeExecution.timestamp, activeExecution.randomness)
  for (const [contract, state] of snapshots) await instantiateContract(contract, state)
}

const runAtomicMutation = async (seed: string, contract: string, callback) => {
  if (activeExecution) return callback()
  const timestamp = Number(lastBlock.timestamp ?? 0)
  activeExecution = { counters: snapshotCounters(), deployed: new Set(), snapshots: new Map(), seed, timestamp }
  beginExecution(seed, timestamp)
  try {
    snapshotContract(contract)
    return await callback()
  } catch (error) {
    await rollbackExecution()
    throw error
  } finally {
    activeExecution = undefined
    activeMeter = undefined
  }
}

const get = async ({ contract, method, params }) => {
  const topLevelRead = !activeMeter
  if (topLevelRead) beginExecution(`read:${contract}:${method}:${JSON.stringify(params ?? [], jsonStringifyBigInt)}`)
  try {
    const member = contracts[contract][method]
    if (typeof member === 'function') return await member.apply(contracts[contract], params ?? [])
    return member
  } finally {
    if (topLevelRead) {
      activeMeter = undefined
    }
  }
}

const respond = (id, value) => {
  worker.postMessage({
    type: 'response',
    value,
    id
  })
}

const askFor = (question, input?) =>
  new Promise((resolve, reject) => {
    const id = globalThis.crypto.randomUUID()
    const onResponse = result => {
      pubsub.unsubscribe(id, onResponse)
      if (result.error) reject(new Error(result.error))
      else resolve(result.input)
    }
    pubsub.subscribe(id, onResponse)
    worker.postMessage({
      type: 'ask',
      question,
      input,
      id
    })
  })

const resolveContract = (hash) => askFor('contract', hash)

const runTask = async (id, taskName, input) => {
  try {
    const result = await _[taskName](input)
    respond(id, result)
  } catch (e) {
    worker.postMessage({
      type: `${taskName}Error`,
      message: e.message,
      transactionHash: e.transactionHash,
      id
    })
  }
}

let taskQueue = Promise.resolve()
const queueTask = (id, taskName, input) => {
  taskQueue = taskQueue.then(() => runTask(id, taskName, input))
}
const queueRead = (id, input) => {
  taskQueue = taskQueue.then(() => runTask(id, 'get', input))
}


const addToWantList = (hash) => {
  worker.postMessage({
    type: 'addToWantList',
    hash
  })
}

export interface TransactionExecution {
  hash: string
  from: string
  to: string
  method: string
  params: unknown[]
  timestamp: number
  feePayments: { payments: Array<{ to: string; amount: bigint }>; burned: bigint }
}

const _ = {
  get,
  runContract: async ({ decoded, hash, encoded }, state?) => {
    const topLevelDeployment = !activeExecution
    try {
      if (topLevelDeployment) beginExecution(`deploy:${hash}`, Number(lastBlock.timestamp ?? 0))
      const cached = readOnly ? readCodeCache.get(hash) : undefined
      const source = cached?.source ?? instrumentContractSource(new TextDecoder().decode(decoded.contract))
      if (readOnly && !cached) {
        const size = encoded.byteLength + source.length * 2
        if (size <= 8 * 1024 * 1024) {
          while (readCodeCache.size && (readCodeCache.size >= 128 || readCodeBytes + size > 8 * 1024 * 1024)) {
            const oldest = readCodeCache.keys().next().value
            readCodeBytes -= readCodeCache.get(oldest).size
            readCodeCache.delete(oldest)
          }
          readCodeCache.set(hash, { decoded: cloneState(decoded), encoded: encoded.slice(), source, size })
          readCodeBytes += size
        }
      }
      const func = new Function('__lfcMeter', 'Date', 'crypto', source)
      const Contract = func(meterBridge, dateBridge, cryptoBridge)
      if (activeExecution && !contractDefinitions[hash]) activeExecution.deployed.add(hash)
      contractDefinitions[hash] = {
        Contract,
        constructorParameters: [...decoded.constructorParameters],
        creator: decoded.creator
      }
      await instantiateContract(hash, state)

      debug(`loaded contract: ${hash} size: ${formatBytes(encoded.length)}`)
    } catch (e) {
      if (!readOnly) console.log(e)
      worker.postMessage({
        type: 'contractError',
        message: e.message,
        hash
      })
      throw e
    } finally {
      if (topLevelDeployment) {
        activeMeter = undefined
        activeCrypto = undefined
      }
    }
  },
  execute: async ({ contract, method, params, sender, executionSeed, executionTimestamp, executionRandomness }) => {
    if (readOnly) throw new Error('Read-only worker cannot execute canonical transactions')
    const topLevel = !activeExecution
    try {
      if (topLevel) {
        const seed = executionSeed ?? `${contract}:${method}:${JSON.stringify(params, jsonStringifyBigInt)}`
        const timestamp = Number(executionTimestamp ?? lastBlock.timestamp ?? 0)
        activeExecution = {
          counters: snapshotCounters(),
          deployed: new Set(),
          snapshots: new Map(),
          seed,
          timestamp,
          randomness: executionRandomness
        }
        beginExecution(seed, timestamp, executionRandomness)
      }
      let result

      if (sender) globalThis.msg = createMessage(sender, contract)
      snapshotContract(contract)

      // don't execute the method on a proxy
      if (contracts[contract].fallback) {
        result = await contracts[contract].fallback(method, params)
      } else {
        result = await contracts[contract][method](...params)
      }
      if (contract === nativeToken) {
        nativeCalls += 1n
        if (method === 'burn') {
          nativeBurns = nativeBurns += 1n
          totalBurnAmount += BigInt(params[1])
        }
        if (method === 'mint') {
          nativeMints = nativeMints += 1n
          totalMintAmount += BigInt(params[1])
        }
        if (method === 'transfer') {
          nativeTransfers = nativeTransfers += 1n
          totalTransferAmount += BigInt(params[1])
        }
        if (method === 'transferFrom') {
          nativeTransfers = nativeTransfers += 1n
          totalTransferAmount += BigInt(params[2])
        }

        // if (method === 'transferFrom') {
        //   nativeTransfers = nativeTransfers += 1n
        //   totalTransferAmount += params[1]
        // }
      }
      totalTransactions += 1n
      // state.put(result)
      return result
    } catch (e) {
      if (topLevel && activeExecution) await rollbackExecution()
      console.log({ e })
      throw new Error(
        `error: ${e.message}
        contract: ${contract}
        method: ${method}
        params: ${JSON.stringify(params, jsonStringifyBigInt, '\t')}
        `
      )
    } finally {
      if (topLevel) {
        activeExecution = undefined
        activeMeter = undefined
        activeCrypto = undefined
      }
    }
  },
  collectFee: async ({ from, payments, burned = 0n }) => {
    if (readOnly) throw new Error('Read-only worker cannot collect fees')
    burned = BigInt(burned)
    const seed = `fee:${from}:${JSON.stringify(payments, jsonStringifyBigInt)}:${burned}`
    return runAtomicMutation(seed, nativeToken, () => {
      const total = payments.reduce((sum, payment) => sum + BigInt(payment.amount), burned)
      const balance = BigInt(contracts[nativeToken].balanceOf(from) || 0n)
      if (balance < total) throw new Error(`insufficient balance for transaction fee: need ${total}, got ${balance}`)

      globalThis.msg = createMessage(from, nativeToken)
      for (const payment of payments) {
        const amount = BigInt(payment.amount)
        if (amount > 0n) contracts[nativeToken].transfer(payment.to, amount)
      }
      if (burned > 0n) {
        globalThis.msg = createMessage(MONETARY_POLICY_AUTHORITY, nativeToken)
        contracts[nativeToken].burn(from, burned)
      }
      return total
    })
  },
  executeTransactions: async (transactions: TransactionExecution[]) => {
    if (readOnly) throw new Error('Read-only worker cannot execute canonical transactions')
    if (!Array.isArray(transactions) || transactions.length > MAX_BLOCK_TRANSACTIONS)
      throw new Error('Invalid transaction execution batch')
    for (const transaction of transactions) {
      try {
        const { payments, burned } = transaction.feePayments
        if (payments.length || burned > 0n) await _.collectFee({ from: transaction.from, payments, burned })
        await _.execute({
          contract: transaction.to, method: transaction.method, params: transaction.params,
          sender: transaction.from, executionSeed: transaction.hash, executionTimestamp: transaction.timestamp,
          executionRandomness: undefined
        })
      } catch (error) {
        throw Object.assign(new Error(`Transaction ${transaction.hash} execution failed: ${error.message}`), {
          transactionHash: transaction.hash
        })
      }
    }
    return true
  },
  settleRewards: async ({ rewards }) => {
    if (readOnly) throw new Error('Read-only worker cannot mint rewards')
    const seed = `rewards:${JSON.stringify(rewards, jsonStringifyBigInt)}`
    return runAtomicMutation(seed, nativeToken, () => {
      globalThis.msg = createMessage(MONETARY_POLICY_AUTHORITY, nativeToken)
      let minted = 0n
      for (const [validator, rawAmount] of rewards) {
        const amount = BigInt(rawAmount)
        if (amount > 0n) contracts[nativeToken].mint(validator, amount)
        minted += amount
      }
      return minted
    })
  },
  init: async (message) => {
    if (readOnly && !message.readOnly) throw new Error('Read-only worker cannot become a canonical worker')
    if (message.readOnly) {
      readOnly = true
      contracts = {}
      contractDefinitions = {}
      activeExecution = undefined
      activeMeter = undefined
      activeCrypto = undefined
    }
    let { peerid, fromState, state, info } = message
    if (readOnly) readBaseline = stateFingerprint(state)

    globalThis.peerid = peerid

    nativeCalls = BigInt(info?.nativeCalls ?? 0)
    nativeMints = BigInt(info?.nativeMints ?? 0)
    nativeBurns = BigInt(info?.nativeBurns ?? 0)
    nativeTransfers = BigInt(info?.nativeTransfers ?? 0)
    totalTransactions = BigInt(info?.totalTransactions ?? 0)
    totalBurnAmount = BigInt(info?.totalBurnAmount ?? 0)
    totalMintAmount = BigInt(info?.totalMintAmount ?? 0)
    totalTransferAmount = BigInt(info?.totalTransferAmount ?? 0)
    totalBlocks = BigInt(info?.totalBlocks ?? 0)

    if (fromState) {
      if (message.lastBlock) {
        lastBlock = message.lastBlock
      }

      const setState = async (address, state?) => {
        if (readOnly && readCodeCache.has(address)) {
          // Re-evaluate the cached instrumented source, never reuse a live class:
          // static fields and lexical closure variables must not leak between reads.
          const cached = readCodeCache.get(address)
          await _.runContract({ hash: address, decoded: cached.decoded, encoded: cached.encoded }, state)
          return
        }
        const contractBytes = await resolveContract(address)
        if (!contractBytes || contractBytes === address) {
          addToWantList(address)
          throw new Error(`Checkpoint contract unavailable: ${address}`)
        }
        const contract = await new ContractMessage(contractBytes)
        if (await contract.hash() !== address) throw new Error(`Checkpoint contract hash mismatch: ${address}`)

        await _.runContract({ hash: address, decoded: contract.decoded, encoded: contract.encoded }, state)
      }

      const entries = Object.entries(state)
      if (entries.length > 0) {
        for (const [address, value] of entries) {
          await setState(address, value)
        }
      }

      if (!contracts[addresses.contractFactory]) await setState(addresses.contractFactory)
      if (!contracts[addresses.nameService]) await setState(addresses.nameService)
      if (!contracts[addresses.validators]) await setState(addresses.validators)
      if (!contracts[addresses.nativeToken]) await setState(addresses.nativeToken)
      // contracts = await Promise.all(
      //   contracts.map(async (contract) => {
      //     contract = await new ContractMessage(new Uint8Array(contract.split(',')))
      //     await _.runContract({ decoded: contract.decoded, encoded: contract.encoded, hash: await contract.hash() })
      //     return contract
      //   })
      // )
    } else {
      for (const contract of [contractFactoryMessage, nativeTokenMessage, nameServiceMessage, validatorsMessage]) {
        const contractMessage: ContractMessage = await new ContractMessage(new Uint8Array(contract.split(',')))
        await _.runContract({
          decoded: contractMessage.decoded,
          encoded: contractMessage.encoded,
          hash: await contractMessage.hash()
        })
      }
    }
    // Startup only restores a verified checkpoint. Unapplied blocks are executed
    // by Chain's canonical application path, never by a second replay engine.
    blocks = message.blocks ?? []
    if (!readOnly && (!Array.isArray(blocks) || blocks.length !== Number(lastBlock.index) + 1 ||
      (blocks.length && blocks.at(-1)?.hash !== lastBlock.hash))) throw new Error('Checkpoint history does not match tip')
    for (let index = 0; index < blocks.length; index++) {
      if (Number(blocks[index]?.index) !== index ||
        blocks[index].previousHash !== (index ? blocks[index - 1].hash : '0x0'))
        throw new Error('Invalid checkpoint history')
    }
    globalThis.blocks = blocks
    latestTransactions.splice(0, latestTransactions.length, ...blocks.slice(-24).flatMap(block => block.transactions))
    return true
  },
  read: async ({ contract, method, params, sender = 'leofcoin:read-only' }) => {
    if (!readOnly) throw new Error('Contract queries require a separate read-only worker')
    globalThis.msg = createMessage(sender, contract)
    beginExecution(`read:${contract}:${method}:${JSON.stringify(params, jsonStringifyBigInt)}`)
    try {
      const result = cloneState(await get({ contract, method, params }))
      const snapshot = await _.snapshot()
      if (stateFingerprint(snapshot.states) !== readBaseline) throw new Error('Read-only call attempted to change contract state')
      return result
    } finally {
      activeMeter = undefined
      activeCrypto = undefined
      globalThis.msg = undefined
    }
  },
  snapshot: async () => {
    const states = {}
    for (const address of Object.keys(contracts)) states[address] = cloneState(await get({ contract: address, method: 'state', params: [] }))
    return { lastBlock: cloneState(lastBlock), states, info: { ...snapshotCounters(), totalBlocks } }
  },
  addLoadedBlock: (block) => {
    const size = formatBytes(encodeValue(block).length)
    const index = Number(block.index)
    const tipIndex = Number(lastBlock.index)
    if (
      !['number', 'bigint'].includes(typeof block.index) ||
      !Number.isSafeInteger(index) || index < 0 || typeof block.hash !== 'string' || !block.hash
    ) {
      throw new Error('Invalid loaded block identity')
    }
    if (lastBlock.hash !== '0x0') {
      if (index < tipIndex) return false
      if (index === tipIndex) {
        if (block.hash === lastBlock.hash) return false
        throw new Error(`Loaded block conflict at index ${index}`)
      }
    }
    const expectedIndex = lastBlock.hash === '0x0' ? 0 : tipIndex + 1
    if (index !== expectedIndex || block.previousHash !== lastBlock.hash) {
      throw new Error(`Loaded block does not extend canonical tip at index ${index}`)
    }
    blocks[block.index.toString()] = block
    lastBlock = blocks[blocks.length - 1]
    totalBlocks += 1n
    worker.postMessage({
      type: 'debug',
      message: `added block: ${block.hash}@${block.index} size: ${size}`
    })
    return true
  },
  loadBlock: (block) => {
    // todo validate here and deprecate addLoadedBlock
  }
}

worker.onmessage(({ id, type, input, error }) => {
  if (pubsub.hasSubscribers(id)) {
    pubsub.publish(id, { input, error })
    return
  }
  switch (type) {
    case 'init':
      queueTask(id, 'init', input)
      break
    case 'run':
      queueTask(id, 'runContract', input)
      break
    case 'execute':
      queueTask(id, 'execute', input)
      break
    case 'executeTransactions':
      queueTask(id, 'executeTransactions', input)
      break
    case 'addLoadedBlock':
      queueTask(id, 'addLoadedBlock', input)
      break
    case 'collectFee':
      queueTask(id, 'collectFee', input)
      break
    case 'settleRewards':
      queueTask(id, 'settleRewards', input)
      break
    case 'snapshot':
      queueTask(id, 'snapshot', input)
      break
    case 'contracts':
      respond(id, contracts)
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
    case 'lastBlockHeight':
      respond(id, lastBlock.index)
      break
    case 'latestTransactions':
      respond(id, latestTransactions)
      break
    case 'has':
      respond(id, has(input.address))
      break
    case 'get':
      queueRead(id, input)
      break
    case 'read':
      queueTask(id, 'read', input)
      break
    case 'totalContracts':
      respond(id, Object.keys(contracts).length)
      break
    case 'nativeCalls':
      respond(id, nativeCalls.toString())
      break
    case 'nativeMints':
      respond(id, nativeMints.toString())
      break
    case 'nativeBurns':
      respond(id, nativeBurns.toString())
      break
    case 'nativeTransfers':
      respond(id, nativeTransfers.toString())
      break
    case 'totalBurnAmount':
      respond(id, totalBurnAmount.toString())
      break
    case 'totalMintAmount':
      respond(id, totalMintAmount.toString())
      break
    case 'totalTransferAmount':
      respond(id, totalTransferAmount.toString())
      break
    case 'totalBlocks':
      respond(id, totalBlocks.toString())
      break
    case 'totalTransactions':
      respond(id, totalTransactions.toString())
      break

    default:
      console.log(`machine-worker: unsupported taskType: ${type}`)
      break
  }
})

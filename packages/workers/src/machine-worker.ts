import { BlockMessage, ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { formatBytes, jsonParseBigInt, jsonStringifyBigInt } from '@leofcoin/utils'
import addresses from '@leofcoin/addresses'
import bytecodes from '@leofcoin/lib/bytecodes.json' assert { type: 'json' }
import {
  calculateFee,
  distributeTransactionFee,
  supportsTransactionFees,
  calculateMonetaryPolicy,
  distributeAmount,
  supportsMonetaryPolicy,
  MONETARY_POLICY_AUTHORITY,
  validateBlockResourceLimits
} from '@leofcoin/lib'
import EasyWorker from '@vandeurenglenn/easy-worker'
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
  const params = [...definition.constructorParameters]
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
    if (params?.length > 0) return await contracts[contract][method](...params)
    return contracts[contract][method]
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

const resolveContract = (hash) => askFor('contract', hash)

const resolveTransaction = (hash) => askFor('transaction', hash)

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

let taskQueue = Promise.resolve()
const queueTask = (id, taskName, input) => {
  taskQueue = taskQueue.then(() => runTask(id, taskName, input))
}
const queueRead = (id, input) => {
  taskQueue = taskQueue.then(async () => respond(id, await get(input)))
}

const _executeTransaction = async (
  transaction,
  validators: string[],
  feesEnabled: boolean,
  burnBasisPoints: bigint
) => {
  const hash = await new TransactionMessage(transaction).hash()
  if (latestTransactions.includes(hash)) {
    throw new Error(`double transaction found: ${hash}`)
  } else {
    latestTransactions.push(hash)
    const { from, to, method, params, nonce } = transaction
    globalThis.msg = createMessage(from, to)
    globalThis.state = await createState()

    if (feesEnabled) {
      const fee = BigInt(await calculateFee(transaction))
      const { payments, burned } = distributeTransactionFee(fee, hash, validators, burnBasisPoints)
      await _.collectFee({ from, payments, burned })
    }
    await _.execute({
      contract: to,
      method,
      params,
      executionSeed: hash,
      executionTimestamp: Number(lastBlock.timestamp ?? transaction.timestamp ?? 0)
    })

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

const addToWantList = (hash) => {
  worker.postMessage({
    type: 'addToWantList',
    hash
  })
}

const _ = {
  runContract: async ({ decoded, hash, encoded }, state?) => {
    const topLevelDeployment = !activeExecution
    try {
      if (topLevelDeployment) beginExecution(`deploy:${hash}`, Number(lastBlock.timestamp ?? 0))
      const source = instrumentContractSource(new TextDecoder().decode(decoded.contract))
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
      console.log(e)
      worker.postMessage({
        type: 'contractError',
        message: e.message,
        hash
      })
    } finally {
      if (topLevelDeployment) {
        activeMeter = undefined
        activeCrypto = undefined
      }
    }
  },
  execute: async ({ contract, method, params, sender, executionSeed, executionTimestamp, executionRandomness }) => {
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
  settleRewards: async ({ rewards }) => {
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
    let { peerid, fromState, state, info } = message
    if (info) info = JSON.parse(info, jsonParseBigInt)
    if (state) state = JSON.parse(state, jsonParseBigInt)

    globalThis.peerid = peerid
    console.log({ fromState, info })

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
        lastBlock = JSON.parse(message.lastBlock, jsonParseBigInt)
      }

      const setState = async (address, state?) => {
        const contractBytes = await resolveContract(address)
        if (contractBytes === address) {
          addToWantList(address)
          return
        }
        const contract = await new ContractMessage(contractBytes)

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
      console.log({ blocks: message.blocks })
      if (message.blocks?.length > 0) {
        // let pre

        // try {
        //   const importee = await import('url')
        //   const url = importee.default
        //   if (url) pre = url.fileURLToPath(new URL('.', import.meta.url))
        // } catch {
        //   // browser env
        //   pre = './'
        // }

        // let _worker = await new EasyWorker(pre + '@leofcoin/workers/block-worker.js', {
        //   serialization: 'advanced',
        //   type: 'module'
        // })
        // blocks = await _worker.once(message.blocks)
        // _worker = null
        // blocks = unique(globalThis.blocks ? globalThis : [], blocks)
        // for (let i = 0; i < blocks.length; i++) {

        // }
        blocks = message.blocks
        for (const block of blocks) {
          // we only revalidate the latest 24 blocks
          // every 24 blocks a snapshot is taken and stored in state
          // this means contracts will be restored from this state
          // this also means devs NEED to make sure the state can be restored
          // on contract deploy an error will be thrown if state wasn't recoverable
          if (block.index >= blocks.length - 24) {
            const transactionCount = blocks[block.index].transactions.length
            latestTransactions.splice(-transactionCount, latestTransactions.length)
          }
          if (!block.loaded && !fromState) {
            totalBlocks += 1n
            try {
              const transactions = await Promise.all(
                block.transactions.map(async (transaction) => {
                  const message = new TransactionMessage(await resolveTransaction(transaction)).decode()
                  if (message === transaction) {
                    throw new Error(`nothing found for ${transaction}`)
                  }
                  return message
                })
              )
              const validators = block.validators.map(({ address }) => address)
              transactions.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority ? -1 : 1
                const left = BigInt(a.nonce)
                const right = BigInt(b.nonce)
                return left < right ? -1 : left > right ? 1 : 0
              })
              const feesEnabled = supportsTransactionFees(block.protocolVersion)
              const monetaryPolicyEnabled = supportsMonetaryPolicy(block.protocolVersion)
              if (monetaryPolicyEnabled) await validateBlockResourceLimits(transactions)
              const policy = monetaryPolicyEnabled
                ? calculateMonetaryPolicy(
                    BigInt(await get({ contract: nativeToken, method: 'totalSupply', params: [] })),
                    BigInt(await get({ contract: nativeToken, method: 'targetSupply', params: [] }))
                  )
                : { subsidy: 0n, burnBasisPoints: 1_000n }
              for (const transaction of transactions) {
                await _executeTransaction(transaction, validators, feesEnabled, policy.burnBasisPoints)
              }
              if (monetaryPolicyEnabled && policy.subsidy > 0n) {
                _.settleRewards({
                  rewards: [...distributeAmount(policy.subsidy, validators, Number(block.index) % validators.length)]
                })
              }
              block.loaded = true
              worker.postMessage({
                type: 'debug',
                message: `loaded transactions for block: ${block.hash} @${block.index}`
              })
            } catch (error) {
              // just tell chain it's ready so we can get this node sync
              // when a node connects this node will try to resolve the wantList
              // this should result in the node beeing sync
              if (error.message.includes('nothing found for')) worker.postMessage({ type: 'machine-ready', lastBlock })
              else console.error(error)
            }
          }
        }
        if (blocks.length > 0) {
          lastBlock = blocks[blocks.length - 1]
        }
        globalThis.blocks = blocks
      }
    }

    worker.postMessage({ type: 'machine-ready', lastBlock })
  },
  addLoadedBlock: (block) => {
    const size = formatBytes(block.length)
    block = JSON.parse(block, jsonParseBigInt)
    // if (block.decoded) block = { ...block.decoded, hash: await new BlockMessage(block).hash() }
    // if (blocks[block.index - 1]) {
    //   console.warn(`block ${block.index} already loaded, skipping`)
    //   return false
    // }
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

worker.onmessage(({ id, type, input }) => {
  if (pubsub.hasSubscribers(id)) {
    pubsub.publish(id, input)
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
    case 'addLoadedBlock':
      queueTask(id, 'addLoadedBlock', input)
      break
    case 'collectFee':
      queueTask(id, 'collectFee', input)
      break
    case 'settleRewards':
      queueTask(id, 'settleRewards', input)
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

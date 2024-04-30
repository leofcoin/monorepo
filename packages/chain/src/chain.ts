import '@vandeurenglenn/debug'
import { BigNumber, formatUnits, parseUnits, formatBytes } from '@leofcoin/utils'
import { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } from '@leofcoin/messages'
import addresses from '@leofcoin/addresses'
import { signTransaction } from '@leofcoin/lib'
import {
  contractFactoryMessage,
  nativeTokenMessage,
  validatorsMessage,
  nameServiceMessage,
  calculateFee
} from '@leofcoin/lib'
import { BigNumberish } from '@ethersproject/bignumber'
import State from './state.js'
import { Address } from './types.js'
import semver from 'semver'
import { VersionControl } from './version-control.js'
import Validators from '@leofcoin/contracts/validators'

globalThis.BigNumber = BigNumber

const debug = globalThis.createDebugger('leofcoin/chain')

// check if browser or local
export default class Chain extends VersionControl {
  #state

  #slotTime = 10000
  id
  utils = {}
  /** {Address[]} */
  #validators = []

  /** {Boolean} */
  #runningEpoch = false

  #participants = []
  #participating = false
  #jail = []

  constructor(config) {
    super(config)
    // @ts-ignore
    return this.#init()
  }

  get nativeToken() {
    return addresses.nativeToken
  }

  get validators() {
    return [...this.#validators]
  }

  async hasTransactionToHandle() {
    const size = await globalThis.transactionPoolStore.size()
    if (size > 0) return true
    return false
  }

  async #runEpoch() {
    this.#runningEpoch = true
    console.log('epoch')
    const validators = await this.staticCall(addresses.validators, 'validators')
    console.log({ validators })

    if (!validators.includes(peernet.selectedAccount)) return
    const start = Date.now()
    try {
      await this.#createBlock()
    } catch (error) {
      console.error(error)
    }

    const end = Date.now()
    console.log((end - start) / 1000 + ' s')

    if (await this.hasTransactionToHandle()) return this.#runEpoch()
    this.#runningEpoch = false
    // if (await this.hasTransactionToHandle() && !this.#runningEpoch) return this.#runEpoch()
  }

  async #setup() {
    const contracts = [
      {
        address: addresses.contractFactory,
        message: contractFactoryMessage
      },
      {
        address: addresses.nativeToken,
        message: nativeTokenMessage
      },
      {
        address: addresses.validators,
        message: validatorsMessage
      },
      {
        address: addresses.nameService,
        message: nameServiceMessage
      }
    ]

    await Promise.all(
      contracts.map(async ({ address, message }) => {
        // @ts-ignore
        message = await new ContractMessage(Uint8Array.from(message.split(',').map((string) => Number(string))))
        // @ts-ignore
        await globalThis.contractStore.put(address, message.encoded as ContractMessage['encoded'])
      })
    )
    console.log('handle native contracts')
    // handle native contracts
  }

  async #init() {
    // this.node = await new Node()
    this.#participants = []
    this.#participating = false
    const initialized = await globalThis.contractStore.has(addresses.contractFactory)
    if (!initialized) await this.#setup()

    this.utils = { BigNumber, formatUnits, parseUnits }

    // this.#state = new State()

    // todo some functions rely on state
    await super.init()

    await globalThis.peernet.addRequestHandler('bw-request-message', () => {
      return new BWMessage(globalThis.peernet.client.bw) || { up: 0, down: 0 }
    })

    // await globalThis.peernet.addRequestHandler('peerId', () => {
    //   let node =
    //   globalThis.peernet.protos['peernet-response']({response: node.encoded})
    // })

    await globalThis.peernet.addRequestHandler('transactionPool', this.#transactionPoolHandler.bind(this))
    await globalThis.peernet.addRequestHandler('version', this.#versionHandler.bind(this))

    globalThis.peernet.subscribe('add-block', this.#addBlock.bind(this))

    globalThis.peernet.subscribe('invalid-transaction', this.#invalidTransaction.bind(this))

    globalThis.peernet.subscribe('send-transaction', this.#sendTransaction.bind(this))

    globalThis.peernet.subscribe('add-transaction', this.#addTransaction.bind(this))

    globalThis.peernet.subscribe('validator:timeout', this.#validatorTimeout.bind(this))

    globalThis.pubsub.subscribe('peer:connected', this.#peerConnected.bind(this))

    globalThis.pubsub.publish('chain:ready', true)
    return this
  }

  async #invalidTransaction(hash) {
    hash = new TextDecoder().decode(hash)

    await globalThis.transactionPoolStore.delete(hash)
    console.log(`removed invalid transaction: ${hash}`)
  }

  async #validatorTimeout(validatorInfo) {
    setTimeout(() => {
      this.#jail.splice(this.#jail.indexOf(validatorInfo.address), 1)
    }, validatorInfo.timeout)
    this.#jail.push(validatorInfo.address)
  }

  #addTransaction = async (message) => {
    const transaction = new TransactionMessage(message)
    const hash = await transaction.hash()
    // if (await transactionPoolStore.has(hash)) await transactionPoolStore.delete(hash)
    debug(`added ${hash}`)
  }

  async #prepareRequest(request) {
    let node = await new globalThis.peernet.protos['peernet-request']({ request })
    return globalThis.peernet.prepareMessage(node)
  }

  async #makeRequest(peer, request) {
    const node = await this.#prepareRequest(request)
    let response = await peer.request(node.encoded)
    response = await new globalThis.peernet.protos['peernet-response'](new Uint8Array(Object.values(response)))
    return response.decoded.response
  }

  async getPeerTransactionPool(peer) {
    const transactionsInPool = await this.#makeRequest(peer, 'transactionPool')

    // todo iterate vs getting all keys?
    const transactions = await globalThis.transactionPoolStore.keys()

    const transactionsToGet = []

    for (const key of transactionsInPool) {
      !transactions.includes(key) &&
        transactionsToGet.push(transactionPoolStore.put(key, await peernet.get(key, 'transaction')))
    }
    return Promise.all(transactionsToGet)
  }

  async #peerConnected(peerId) {
    const peer = peernet.getConnection(peerId)

    // todo handle version changes
    // for now just do nothing if version doesn't match
    debug(`peer connected with version ${peer.version}`)
    if (peer.version !== this.version) {
      debug(`versions don't match`)
    }

    if (!peer.version || peer.version !== this.version) return

    const lastBlock = await this.#makeRequest(peer, 'lastBlock')

    const localBlock = await this.lastBlock
    const higherThenCurrentLocal = !localBlock.index ? true : lastBlock.index > localBlock.index

    if (Object.keys(lastBlock).length > 0) {
      if (!this.lastBlock || higherThenCurrentLocal) {
        this.knownBlocks = await this.#makeRequest(peer, 'knownBlocks')

        await this.syncChain(lastBlock)
      } else if (!this.knownBlocks) this.knownBlocks = await this.#makeRequest(peer, 'knownBlocks')
    }

    setTimeout(async () => {
      const peerTransactionPool = (higherThenCurrentLocal && (await this.getPeerTransactionPool(peer))) || []
      if (this.#participating && peerTransactionPool.length > 0) return this.#runEpoch()
    }, 3000)
  }

  #epochTimeout

  async #transactionPoolHandler() {
    const pool = await globalThis.transactionPoolStore.keys()
    return new globalThis.peernet.protos['peernet-response']({ response: pool })
  }

  async #versionHandler() {
    return new globalThis.peernet.protos['peernet-response']({ response: { version: this.version } })
  }

  async #executeTransaction({ hash, from, to, method, params, nonce }) {
    try {
      let result = await this.machine.execute(to, method, params)
      // await accountsStore.put(to, nonce)
      await transactionPoolStore.delete(hash)
      // if (!result) result = this.machine.state
      globalThis.pubsub.publish(`transaction.completed.${hash}`, { status: 'fulfilled', hash })
      return result || 'no state change'
    } catch (error) {
      await transactionPoolStore.delete(hash)
      globalThis.peernet.publish('invalid-transaction', hash)
      globalThis.pubsub.publish(`transaction.completed.${hash}`, { status: 'fail', hash, error: error })
      throw { error, hash, from, to, params, nonce }
    }
  }

  async #addBlock(block) {
    const blockMessage = await new BlockMessage(block)

    const hash = await blockMessage.hash()

    const transactionsMessages = await Promise.all(
      blockMessage.decoded.transactions
        // @ts-ignore
        .map(async (hash) => {
          let data
          if (!(await transactionStore.has(hash))) {
            data = await peernet.get(hash, 'transaction')
            transactionStore.put(hash, data)
          } else {
            data = transactionStore.get(hash)
          }
          ;(await transactionPoolStore.has(hash)) && (await transactionPoolStore.delete(hash))
          return new TransactionMessage(data).decode()
        })
    )

    await globalThis.blockStore.put(hash, blockMessage.encoded)

    debug(`added block: ${hash}`)
    let promises = []
    let contracts = []
    for (let transaction of transactionsMessages) {
      // await transactionStore.put(transaction.hash, transaction.encoded)
      if (!contracts.includes(transaction.to)) {
        contracts.push(transaction.to)
      }
      // Todo: go trough all accounts
      //@ts-ignore
      promises.push(this.#executeTransaction(transaction))
    }
    try {
      promises = await Promise.allSettled(promises)
      const noncesByAddress = {}
      for (let transaction of transactionsMessages) {
        globalThis.pubsub.publish('transaction-processed', transaction)
        if (transaction.to === globalThis.peernet.selectedAccount)
          globalThis.pubsub.publish('account-transaction-processed', transaction)
        if (!noncesByAddress[transaction.from] || noncesByAddress?.[transaction.from] < transaction.nonce) {
          noncesByAddress[transaction.from] = transaction.nonce
        }
      }
      await Promise.all(
        Object.entries(noncesByAddress).map(([from, nonce]) => globalThis.accountsStore.put(from, String(nonce)))
      )

      if ((await this.lastBlock).index < Number(blockMessage.decoded.index)) {
        await this.machine.addLoadedBlock({ ...blockMessage.decoded, loaded: true, hash: await blockMessage.hash() })
        await this.updateState(blockMessage)
      }
      globalThis.pubsub.publish('block-processed', blockMessage.decoded)
    } catch (error) {
      console.log(error.hash)
      console.log('errrrr')

      await transactionPoolStore.delete(error.hash)
    }
  }

  async participate(address) {
    // TODO: validate participant
    // hold min amount of 50k ART for 7 days
    // lock the 50k
    // introduce peer-reputation
    // peerReputation(peerId)
    // {bandwith: {up, down}, uptime}
    this.#participating = true
    if (!(await this.staticCall(addresses.validators, 'has', [address]))) {
      const rawTransaction = {
        from: address,
        to: addresses.validators,
        method: 'addValidator',
        params: [address],
        nonce: (await this.getNonce(address)) + 1,
        timestamp: Date.now()
      }

      const transaction = await signTransaction(rawTransaction, globalThis.peernet.identity)
      await this.sendTransaction(transaction)
    }
    if ((await this.hasTransactionToHandle()) && !this.#runningEpoch && this.#participating) await this.#runEpoch()
  }

  async #handleTransaction(transaction, latestTransactions, block) {
    const hash = await transaction.hash()

    const doubleTransactions = []

    if (latestTransactions.includes(hash) || (await transactionStore.has(hash))) {
      doubleTransactions.push(hash)
    }

    if (doubleTransactions.length > 0) {
      await globalThis.transactionPoolStore.delete(hash)
      await globalThis.peernet.publish('invalid-transaction', hash)
      return
    }

    // if (timestamp + this.#slotTime > Date.now()) {
    try {
      const result = await this.#executeTransaction({ ...transaction.decoded, hash })

      block.transactions.push(hash)

      block.fees = block.fees.add(await calculateFee(transaction.decoded))
      await globalThis.accountsStore.put(
        transaction.decoded.from,
        new TextEncoder().encode(String(transaction.decoded.nonce))
      )
    } catch (e) {
      console.log('vvvvvv')

      console.log({ e })
      console.log(hash)
      peernet.publish('invalid-transaction', hash)

      console.log(await globalThis.transactionPoolStore.keys())

      console.log(await globalThis.transactionPoolStore.has(e.hash))

      await globalThis.transactionPoolStore.delete(e.hash)

      console.log(await globalThis.transactionPoolStore.has(e.hash))
    }
  }

  // todo filter tx that need to wait on prev nonce
  async #createBlock(limit = this.transactionLimit) {
    console.log(await globalThis.transactionPoolStore.size())

    // vote for transactions
    if ((await globalThis.transactionPoolStore.size()) === 0) return

    let transactions = await globalThis.transactionPoolStore.values(this.transactionLimit)

    if (Object.keys(transactions)?.length === 0) return

    const timestamp = Date.now()

    let block = {
      transactions: [],
      validators: [],
      fees: BigNumber.from(0),
      timestamp,
      previousHash: '',
      reward: parseUnits('150'),
      index: 0
    }

    const latestTransactions = await this.machine.latestTransactions()
    console.log({ latestTransactions })

    // exclude failing tx
    transactions = await this.promiseTransactions(transactions)

    const normalTransactions = []
    const priorityransactions = []

    for (const transaction of transactions) {
      if (transaction.decoded.priority) priorityransactions.push(transaction)
      else normalTransactions.push(transaction)
    }

    for (const transaction of priorityransactions.sort((a, b) => a.decoded.nonce - b.decoded.nonce)) {
      await this.#handleTransaction(transaction, latestTransactions, block)
    }

    await Promise.all(
      normalTransactions.map((transaction: TransactionMessage) =>
        this.#handleTransaction(transaction, latestTransactions, block)
      )
    )

    // don't add empty block
    if (block.transactions.length === 0) return

    const validators = (await this.staticCall(addresses.validators, 'validators')) as Validators['validators']
    // block.validators = Object.keys(block.validators).reduce((set, key) => {
    //   if (block.validators[key].active) {
    //     push({
    //       address: key
    //     })
    //   }
    // }, [])
    const peers = {}
    for (const entry of globalThis.peernet.peers) {
      peers[entry[0]] = entry[1]
    }

    for (const validator of validators) {
      const peer = peers[validator]
      if (peer && peer.connected && peer.version === this.version) {
        let data = await new BWRequestMessage()
        const node = await globalThis.peernet.prepareMessage(data.encoded)
        try {
          const bw = await peer.request(node.encoded)
          block.validators.push({
            address: validator,
            bw: bw.up + bw.down
          })
        } catch {}
      } else if (globalThis.peernet.selectedAccount === validator) {
        block.validators.push({
          address: globalThis.peernet.selectedAccount,
          bw: globalThis.peernet.bw.up + globalThis.peernet.bw.down
        })
      }
    }

    block.validators = block.validators.map((validator) => {
      validator.reward = block.fees
      validator.reward = validator.reward.add(block.reward)
      validator.reward = validator.reward.div(block.validators.length)
      delete validator.bw
      return validator
    })
    // block.validators = calculateValidatorReward(block.validators, block.fees)

    const localBlock = await this.lastBlock
    block.index = localBlock.index
    if (block.index === undefined) block.index = 0
    else block.index += 1

    block.previousHash = localBlock.hash || '0x0'
    // block.timestamp = Date.now()
    // block.reward = block.reward.toString()
    // block.fees = block.fees.toString()

    try {
      await Promise.all(
        block.transactions.map(async (transaction) => await globalThis.transactionPoolStore.delete(transaction))
      )

      let blockMessage = await new BlockMessage(block)

      const hash = await blockMessage.hash()

      await globalThis.peernet.put(hash, blockMessage.encoded, 'block')
      await this.machine.addLoadedBlock({ ...blockMessage.decoded, loaded: true, hash: await blockMessage.hash() })
      await this.updateState(blockMessage)
      debug(`created block: ${hash} @${block.index}`)

      globalThis.peernet.publish('add-block', blockMessage.encoded)
      globalThis.pubsub.publish('add-block', blockMessage.decoded)
    } catch (error) {
      throw new Error(`invalid block ${block}`)
    }
    // data = await this.machine.execute(to, method, params)
    // transactionStore.put(message.hash, message.encoded)
  }

  async #sendTransaction(transaction) {
    transaction = await new TransactionMessage(transaction.encoded || transaction)
    const hash = await transaction.hash()

    try {
      const has = await globalThis.transactionPoolStore.has(hash)

      if (!has && !(await transactionStore.has(hash))) {
        await globalThis.transactionPoolStore.put(hash, transaction.encoded)
      }
      if (this.#participating && !this.#runningEpoch) this.#runEpoch()
    } catch (e) {
      globalThis.peernet.publish('invalid-transaction', hash)
      throw new Error('invalid transaction')
    }
  }
  /**
   * every tx done is trough contracts so no need for amount
   * data is undefined when nothing is returned
   * error is thrown on error so undefined data doesn't mean there is an error...
   **/
  async sendTransaction(transaction) {
    const transactionMessage = await new TransactionMessage({ ...transaction })
    const event = await super.sendTransaction(transactionMessage)

    this.#sendTransaction(transactionMessage.encoded)
    globalThis.peernet.publish('send-transaction', transactionMessage.encoded)
    return event
  }

  async addContract(transaction, contractMessage) {
    const hash = await contractMessage.hash()
    const has = await this.staticCall(addresses.contractFactory, 'isRegistered', [hash])
    if (has) throw new Error('contract exists')

    const tx = await this.sendTransaction(transaction)
    await tx.wait
    return tx
  }

  /**
   *
   * @param {Address} sender
   * @returns {globalMessage}
   */
  #createMessage(sender = globalThis.peernet.selectedAccount, contract) {
    return {
      contract,
      sender,
      call: this.call,
      staticCall: this.staticCall
    }
  }

  /**
   *
   * @param {Address} sender
   * @param {Address} contract
   * @param {String} method
   * @param {Array} parameters
   * @returns
   */
  internalCall(sender: Address, contract: Address, method: string, parameters?: any[]) {
    globalThis.msg = this.#createMessage(sender, contract)

    return this.machine.execute(contract, method, parameters)
  }

  /**
   *
   * @param {Address} contract
   * @param {String} method
   * @param {Array} parameters
   * @returns
   */
  call(contract: Address, method: string, parameters?: any[]) {
    globalThis.msg = this.#createMessage(peernet.selectedAccount, contract)

    return this.machine.execute(contract, method, parameters)
  }

  staticCall(contract: Address, method: string, parameters?: any[]) {
    globalThis.msg = this.#createMessage(peernet.selectedAccount, contract)
    return this.machine.get(contract, method, parameters)
  }

  mint(to: Address, amount: BigNumberish) {
    return this.call(addresses.nativeToken, 'mint', [to, amount])
  }

  transfer(from: Address, to: Address, amount: BigNumberish) {
    return this.call(addresses.nativeToken, 'transfer', [from, to, amount])
  }

  get balances(): Promise<{ [index: string]: BigNumberish }> {
    return this.staticCall(addresses.nativeToken, 'balances')
  }

  get contracts() {
    return this.staticCall(addresses.contractFactory, 'contracts')
  }

  deleteAll() {
    return this.machine.deleteAll()
  }

  /**
   * lookup an address for a registered name using the builtin nameService
   * @check nameService
   *
   * @param {String} - contractName
   * @returns {String} - address
   *
   * @example chain.lookup('myCoolContractName') // qmqsfddfdgfg...
   */
  lookup(name): Promise<{ owner; address }> {
    return this.call(addresses.nameService, 'lookup', [name])
  }
}

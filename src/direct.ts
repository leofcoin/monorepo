import { formatUnits } from '@leofcoin/utils'

declare var chain
declare var peernet
declare var transactionPoolStore
declare var accountsStore
declare var blockStore

export default class Client {
  url: string
  networkVersion: string
  client

  constructor(url = 'ws://localhost:4040', networkVersion = 'leofcoin-peach') {
    this.url = url
    this.networkVersion = networkVersion
  }

  get pubsub() {
    return {
      publish: globalThis.pubsub.publish,
      subscribe: globalThis.pubsub.subscribe
    }
  }

  balances() {
    return chain.balances
  }

  async balanceOf(address: string, format: boolean) {
    const balances = await chain.balances
    const balance = balances[address]
    return format ? formatUnits(balance) : balance
  }

  selectedAccount() {
    return peernet.selectedAccount
  }

  async selectAccount(address: any) {
    try {
      await globalThis.walletStore.put('selected-account', address)
    } catch (error) {
      throw new Error(`couldn't set selected account`)
    }
  }

  accounts() {
    return chain.accounts
  }

  hasTransactionToHandle() {
    return chain.hasTransactionToHandle()
  }

  getBlock(index: number) {
    return chain.getBlock(index)
  }

  blocks(amount: number) {
    return globalThis.blockStore.values(amount)
  }

  sendTransaction(transaction) {
    return chain.sendTransaction(transaction)
  }
  peerId() {
    return peernet.peerId
  }
  peers() {
    return peernet.peers
  }
  validators() {
    return chain.validators
  }
  lookup(name: string) {
    return chain.lookup(name)
  }
  staticCall(contract: string, method: string, params: {}) {
    return chain.staticCall(contract, method, params)
  }
  totalContracts(): number {
    return chain.totalContracts
  }
  contracts(): number {
    return chain.contracts
  }
  nativeToken(): string {
    return chain.nativeToken
  }
  nativeCalls(): number {
    return chain.nativeCalls
  }
  nativeMints(): number {
    return chain.nativeMints
  }
  nativeBurns(): number {
    return chain.nativeBurns
  }
  nativeTransfers(): number {
    return chain.nativeTransfers
  }
  totalBurnAmount(): number {
    return chain.totalBurnAmount
  }
  totalMintAmount(): number {
    return chain.totalMintAmount
  }
  totalTransferAmount(): number {
    return chain.totalTransferAmount
  }
  totalTransactions(): number {
    return chain.totalTransactions
  }
  totalBlocks(): number {
    return chain.totalBlocks
  }
  poolTransactions() {
    return transactionPoolStore.get()
  }
  async totalSize(): Promise<number> {
    return (await transactionPoolStore.size()) + (await blockStore.size()) + (await accountsStore.size())
  }

  transactionsInPool() {
    return transactionPoolStore.length()
  }
  transactionPoolSize() {
    return transactionPoolStore.size()
  }
  participating(): boolean {
    return chain.participating
  }
  participate(address: string): {} {
    return chain.participate(address)
  }
  createContractAddress(owner: string, code: string, params: {}): {} {
    return chain.createContractAddress(owner, code, params)
  }
  deployContract(code: string, params: {}): {} {
    return chain.deployContract(code, params)
  }
  network() {
    return chain.network
  }

  async networkStats(): Promise<{
    version: string
    peers: {}[]
    accounts: number
    accountsHolding: number
    accountsHoldingAmount: number
    topHolders: any[]
  }> {
    let accountsHolding = 0
    let accountsHoldingAmount = BigInt(0)
    let topHolders = []
    const balances = Object.entries(await chain.balances)
      .map(([holder, amount]): { holder: string; amount: number } => {
        amount = BigInt(amount)
        return { holder, amount }
      })
      .sort((a, b) => formatUnits((b.amount -= a.amount)))

    for (let { holder, amount } of balances) {
      if (amount > 0) {
        accountsHoldingAmount += amount
        accountsHolding += 1
        topHolders.length < 100 && topHolders.push({ holder, amount: formatUnits(amount) })
      }
    }

    return {
      version: peernet.networkVersion,
      peers: peernet.peers.map(([id, peer]) => id),
      accounts: await accountsStore.length(),
      accountsHolding,
      accountsHoldingAmount: formatUnits(accountsHoldingAmount).toString(),
      topHolders
    }
  }

  getNonce(address: string) {
    return chain.getNonce(address)
  }

  lastBlock() {
    return chain.lastBlock
  }

  lastBlockHeight() {
    return chain.lastBlockHeight
  }

  blockHashMap() {
    return chain.blockHashMap
  }

  bootstrap() {
    return chain.blockHashMap
  }
}

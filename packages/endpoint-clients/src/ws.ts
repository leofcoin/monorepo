import { SocketRequestClient } from 'socket-request-client'
import ClientConnection from 'socket-request-client/connection'

export default class Client {
  url: string
  networkVersion: string
  client: ClientConnection

  constructor(url = 'ws://localhost:4040', networkVersion = 'leofcoin-peach') {
    this.url = url
    this.networkVersion = networkVersion
  }

  async init() {
    const client = new SocketRequestClient(this.url, this.networkVersion)
    this.client = (await client.init()) as ClientConnection
  }

  get pubsub() {
    return {
      publish: this.client.pubsub.publish,
      subscribe: this.client.pubsub.subscribe
    }
  }

  request(url: string, params?: {}) {
    return this.client.request({ url, params })
  }

  balances() {
    return this.request('balances')
  }

  balanceOf(address: string, format: boolean) {
    return this.request('balanceOf', { address, format })
  }

  selectedAccount() {
    return this.request('selectedAccount')
  }

  selectAccount(address: any) {
    return this.request('selectAccount', { address })
  }

  accounts() {
    return this.request('accounts')
  }

  hasTransactionToHandle() {
    return this.request('hasTransactionToHandle')
  }

  getBlock(index: number) {
    return this.request('getBlock', { index })
  }

  blocks(amount: number) {
    return this.request('blocks', { amount })
  }

  sendTransaction(transaction) {
    return this.request('sendTransaction', transaction)
  }

  peerId() {
    return this.request('peerId')
  }

  peers() {
    return this.request('peers')
  }

  validators() {
    return this.request('validators')
  }

  lookup(name: string) {
    return this.request('lookup', { name })
  }

  staticCall(contract: string, method: string, params: {}) {
    return this.request('staticCall', { contract, method, params })
  }

  contracts(): Promise<number> {
    return this.request('contracts')
  }

  totalContracts(): Promise<number> {
    return this.request('totalContracts')
  }

  nativeToken(): Promise<string> {
    return this.request('nativeToken')
  }

  nativeCalls(): Promise<number> {
    return this.request('nativeCalls')
  }

  nativeMints(): Promise<number> {
    return this.request('nativeMints')
  }

  nativeBurns(): Promise<number> {
    return this.request('nativeBurns')
  }

  nativeTransfers(): Promise<number> {
    return this.request('nativeTransfers')
  }

  totalBurnAmount(): Promise<number> {
    return this.request('totalBurnAmount')
  }

  totalMintAmount(): Promise<number> {
    return this.request('totalMintAmount')
  }

  totalTransferAmount(): Promise<number> {
    return this.request('totalTransferAmount')
  }

  totalTransactions(): Promise<number> {
    return this.request('totalTransactions')
  }

  totalSize(): Promise<number> {
    return this.request('totalSize')
  }

  totalBlocks(): Promise<number> {
    return this.request('totalBlocks')
  }

  poolTransactions() {
    return this.request('poolTransactions')
  }

  transactionsInPool() {
    return this.request('transactionsInPool')
  }

  transactionPoolSize() {
    return this.request('transactionPoolSize')
  }

  participating(): Promise<boolean> {
    return this.request('participating')
  }

  participate(address: string): {} {
    return this.request('participate', { address })
  }

  createContractAddress(owner: string, code: string, params: {}): {} {
    return this.request('createContractAddress', { owner, code, params })
  }

  deployContract(code: string, params: {}): {} {
    return this.request('deployContract', { code, params })
  }

  network() {
    return this.request('network')
  }

  networkStats(): Promise<{
    version: string
    peers: {}[]
    accounts: number
    accountsHolding: number
  }> {
    return this.request('networkStats')
  }

  getNonce(address: string) {
    return this.request('getNonce', { address })
  }

  lastBlock() {
    return this.request('lastBlock')
  }

  lastBlockHeight() {
    return this.request('lastBlockHeight')
  }

  blockHashMap() {
    return this.request('blockHashMap')
  }

  bootstrap() {
    return this.request('blockHashMap')
  }
}

// see https://developer.mozilla.org/en-US/docs/Web/API/Response#instance_methods
type responseType = 'json' | 'text' | 'arrayBuffer' | 'clone' | 'formData' | 'blob'
type networkVersion = 'peach' | string

export default class Client {
  url: string
  networkVersion: networkVersion
  get isHttpClient() {
    return true
  }

  constructor(url, networkVersion) {
    this.url = url
    this.networkVersion = networkVersion
  }

  async _fetch(method: string, params?, type: responseType = 'json') {
    params = new URLSearchParams(params).toString()
    const response = await fetch(`${this.url}/${method}?${params}`)
    return response[type]()
  }

  async _fetchString(method: string, params?) {
    return String(await this._fetch(method, params, 'text'))
  }

  async _fetchNumber(method: string, params?) {
    return Number(await this._fetchString(method, params))
  }

  async _fetchBoolean(method: string, params?) {
    return Boolean((await this._fetchString(method, params)) === 'true')
  }

  balances() {
    return this._fetch('balances')
  }

  balanceOf(address, format) {
    return this._fetch(`balanceOf`, { address, format })
  }

  selectedAccount() {
    return this._fetchString('selectedAccount')
  }

  selectAccount(address) {
    return this._fetch('selectAccount', { address })
  }

  accounts() {
    return this._fetch('accounts')
  }

  hasTransactionToHandle() {
    return this._fetchBoolean('hasTransactionToHandle')
  }

  getBlock(index) {
    return this._fetch('getBlock', { index })
  }

  blocks(amount) {
    return this._fetch('blocks', { amount })
  }

  sendTransaction(transaction) {
    return this._fetch('sendTransaction', transaction)
  }

  peerId() {
    return this._fetchString('peerId')
  }

  peers() {
    return this._fetch('peers')
  }

  validators() {
    return this._fetch('validators')
  }

  lookup(name) {
    return this._fetch('lookup', { name })
  }

  staticCall(contract, method, params) {
    return this._fetch('staticCall', { contract, method, params })
  }

  contracts() {
    return this._fetch('contracts')
  }

  totalContracts() {
    return this._fetchNumber('totalContracts')
  }

  nativeToken() {
    return this._fetchString('nativeToken')
  }

  nativeCalls() {
    return this._fetchNumber('nativeCalls')
  }

  nativeMints() {
    return this._fetchNumber('nativeMints')
  }

  nativeBurns() {
    return this._fetchNumber('nativeBurns')
  }

  nativeTransfers() {
    return this._fetchNumber('nativeTransfers')
  }

  totalBurnAmount() {
    return this._fetchNumber('totalBurnAmount')
  }

  totalMintAmount() {
    return this._fetchNumber('totalMintAmount')
  }

  totalTransferAmount() {
    return this._fetchNumber('totalTransferAmount')
  }

  totalTransactions() {
    return this._fetchNumber('totalTransactions')
  }

  totalBlocks() {
    return this._fetchNumber('totalBlocks')
  }

  totalSize() {
    return this._fetchNumber('totalSize')
  }

  poolTransactions() {
    return this._fetch('poolTransactions')
  }

  transactionsInPool() {
    return this._fetchNumber('transactionsInPool')
  }

  transactionPoolSize() {
    return this._fetchNumber('transactionPoolSize')
  }

  participating() {
    return this._fetchBoolean('participating')
  }

  participate(address) {
    return this._fetch('participate', { address })
  }

  createContractAddress(owner, code, params) {
    return this._fetch('createContractAddress', { owner, code, params })
  }

  deployContract(code, params) {
    return this._fetch('deployContract', { code, params })
  }

  network() {
    return this._fetch('network')
  }

  networkStats(): Promise<{ version: string; peers: {}[]; accounts: number; accountsHolding: number }> {
    return this._fetch('networkStats')
  }

  getNonce(address: string) {
    return this._fetchNumber('getNonce', { address })
  }

  lastBlock() {
    return this._fetch('lastBlock')
  }

  lastBlockHeight() {
    return this._fetchNumber('lastBlockHeight')
  }

  blockHashMap() {
    return this._fetch('blockHashMap')
  }

  bootstrap() {
    return this._fetch('blockHashMap')
  }
}

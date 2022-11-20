import nodeConfig from './../node_modules/@leofcoin/lib/src/node-config.js'
import Node from './../node_modules/@leofcoin/chain/dist/node.js'
import Chain from './../node_modules/@leofcoin/chain/dist/chain.js';
import { formatUnits } from '@leofcoin/utils';

export default class Api {
  constructor() {
    return this.#init()
  }

  async #init() {
    await new Node({
      network: 'leofcoin:peach'
    })
    console.log(peernet);
    await nodeConfig({
      network: 'leofcoin:peach'
    })
    this._chain = await new Chain()
    console.log(this.chain);
    pubsub.publish('chain:ready', true)
    return this
  }

  get chain() {
    return this._chain
  }

  get node() {
    return globalThis.peernet
  }

  get peerId() {
    return peernet.peerId
  }
  get peers() { return this.node.peers }
  get validators() { return this.chain.validators }
  participate() { return this.chain.participate() }
  get nativeToken() { return this.chain.nativeToken }
  async balanceOf(address) {
    const balances = await this.chain.balances
    
    return formatUnits(balances[address]).toString()
  }
  
  balances() { return this.chain.balances }

  createTransactionFrom(params) { return this.chain.createTransactionFrom(...params) }

  async accounts() {
    const accounts = await walletStore.get('accounts')
    return JSON.parse(new TextDecoder().decode(accounts))
  }

  async selectedAccount() {
    return globalThis.selectedAccount
  }

  async selectAccount(address) {
    return walletStore.put('selected-account', address)
  }
}

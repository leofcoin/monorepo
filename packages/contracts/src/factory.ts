import { PublicVoting, TokenReceiver } from '@leofcoin/standards'

import { TokenReceiverState } from '@leofcoin/standards/token-receiver.js'

export interface FactoryState extends TokenReceiverState {
  contracts: any[]
  totalContracts: bigint
}

export default class Factory extends TokenReceiver {
  /**
   * string
   */
  #name = 'LeofcoinContractFactory'
  /**
   * uint
   */
  #totalContracts: bigint = BigInt(0)
  /**
   * Array => string
   */
  #contracts: address[] = []

  constructor(tokenToReceive: address, tokenAmountToReceive: bigint, state: FactoryState) {
    super(tokenToReceive, tokenAmountToReceive, true, state as TokenReceiverState)
    if (state) {
      this.#contracts = state.contracts
      this.#totalContracts = state.totalContracts
    }
  }

  get state(): FactoryState {
    const baseState = super.state as TokenReceiverState
    return {
      ...baseState,
      totalContracts: this.#totalContracts,
      contracts: this.#contracts
    }
  }

  get name() {
    return this.#name
  }

  get contracts() {
    return [...this.#contracts]
  }

  get totalContracts() {
    return this.#totalContracts
  }

  isRegistered(address: any) {
    return this.#contracts.includes(address)
  }

  #isCreator(address: address) {
    return msg.staticCall(address, 'creator', [msg.sender]) as unknown as boolean
  }

  /**
   * Public hook for creator check to ease testing/stubbing.
   */
  isCreator(address: address) {
    return this.#isCreator(address)
  }

  /**
   *
   * @param {Address} address contract address to register
   */
  async registerContract(address: string) {
    if (!(await this.isCreator(address))) throw new Error(`You don't own that contract`)
    if (this.#contracts.includes(address)) throw new Error('already registered')
    await this._payTokenToReceive()
    this.#totalContracts += 1n
    this.#contracts.push(address)
  }
}

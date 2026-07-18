import { TokenReceiver } from '@leofcoin/standards'
import { TokenReceiverState } from '@leofcoin/standards/token-receiver'

type registry = {
  name?: {
    address: address
    owner: address
  }
}

export interface NameServiceState extends TokenReceiverState {
  registry: registry
}

export default class NameService extends TokenReceiver {
  /**
   * string
   */
  #name: string = 'LeofcoinNameService'
  /**
   * Object => string
   */
  #registry: registry = {}

  get name(): string {
    return this.#name
  }

  get registry(): {} {
    return { ...this.#registry }
  }

  get state(): NameServiceState {
    const baseState = super.state as TokenReceiverState
    return {
      ...baseState,
      registry: this.#registry
    }
  }

  // TODO: control with contract
  constructor(
    factoryAddress: address,
    tokenToReceive: address,
    validatorAddress: address,
    tokenAmountToReceive: bigint,
    state: NameServiceState
  ) {
    super(tokenToReceive, tokenAmountToReceive, true, state as TokenReceiverState)
    if (state) {
      this.#registry = state.registry
    } else {
      this.#registry['LeofcoinContractFactory'] = {
        owner: msg.sender,
        address: msg.contract
      }

      this.#registry['LeofcoinToken'] = {
        owner: msg.sender,
        address: tokenToReceive
      }

      this.#registry['LeofcoinValidators'] = {
        owner: msg.sender,
        address: validatorAddress
      }
    }
  }

  async purchaseName(name: string | number, address: any) {
    if (this.#registry[name]) throw new Error('name already registered')
    await this._payTokenToReceive()

    this.#registry[name] = {
      owner: msg.sender,
      address
    }
  }

  lookup(name: string | number) {
    return this.#registry[name]
  }

  transferOwnership(name: string | number, to: any) {
    if (msg.sender !== this.#registry[name].owner) throw new Error('not allowed')
    this.#registry[name].owner = to
  }

  changeAddress(name: string | number, address: any) {
    if (msg.sender !== this.#registry[name].owner) throw new Error('not allowed')
    this.#registry[name].address = address
  }
}

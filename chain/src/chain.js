import Node from './node'
import { BigNumber, read } from './utils/utils'
import ContractMessage from './messages/contract'
import Machine from './machine'
// check if browser or local
const nativeToken = '5xdacig3od77wogyt3cyjpcoy77ehhqxlqcd24t4f32sxryc4dg4tdsl6y'
export default class Chain {
  #machine

  constructor() {
    return this.#init()
  }

  async #init() {
    this.node = await new Node()


    await peernet.addProto('contract-message', ContractMessage)

    await peernet.addCodec('contract-message', {
      codec: '636d',
      hashAlg: 'keccak-256'
    })

    await peernet.addStore('contract', 'art', '.ArtOnline', false)

    this.#machine = await new Machine()
    this.utils = { BigNumber, read }

    this.peernet = this.node.peernet
    return this
  }

  /**
   *
   */
  deployContract(contract, params = []) {
    globalThis.msg = {sender: peernet.id}
    const message = new ContractMessage({
      creator: peernet.id,
      contract,
      constructorParameters: params
    })
    return this.#machine.addContract(message)
  }

  call(contract, method, params) {
    globalThis.msg = {sender: peernet.id}
    return this.#machine.execute(contract, method, params)
  }

  staticCall(contract, property) {
    globalThis.msg = {sender: peernet.id}
    return this.#machine.get(contract, property)
  }

  mint(to, amount) {
    return this.call(nativeToken, 'mint', [to, amount])
  }

  transfer(from, to, amount) {
    return this.call(nativeToken, 'transfer', [from, to, amount])
  }

  get balances() {
    return this.staticCall(nativeToken, 'balances')
  }
}

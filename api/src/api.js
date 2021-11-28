import BaseAPI from './base'
import addresses from './../../addresses/addresses'
export default class Api extends BaseAPI {
  constructor(network = {}) {
    if (!network.name) network.name = 'mainnet'
    if (!network.chainid) network.chainid = 1
    super(network)

    this._contracts = { signer: { } }
    return this._init(network)
  }

  async _init(network) {
    this.addresses = await addresses(network.name)
    return this
  }

  _initContract(address, abi, provider) {
    const contract = new ethers.Contract(address, abi, provider)
    if (provider._isSigner) {
      this._contracts.signer[address] = contract
    } else {
      this._contracts[address] = contract
    }
    return contract
  }

  getContract(address, abi, signer) {
    address = address.toLowerCase()
    let contract
    if (signer) {
      contract =  this._contracts.signer[address] ||
        this._initContract(address, abi, this.signer)
    } else {
      contract = this._contracts[address] ||
        this._initContract(address, abi, this.provider)
    }

    return contract
  }
}

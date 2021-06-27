import LISTING_ABI from './abis/listing.js'
import EXCHANGE_ABI from './abis/exchange.js'
import ARTEON_ABI from './abis/arteon.js'
import bytecode from './bytecodes/listing.js'

export default class Api {
  constructor(signer) {
    return this._init(signer)
  }

  async _init(signer) {
    this.signer = signer
    if (!this.signer.address) {
      this.signer.address = await this.signer.getAddress()
    }

    return this
  }

  get assets() {
    return {
      GENESIS: './assets/cards/GENESIS-720.png',
      'ARTX 1000': './assets/cards/ARTX 1000-720.png',
      'ARTX 2000': './assets/cards/ARTX 2000-720.png'
    }
  }

  get maximumSupply() {
    return {
      GENESIS: 50,
      'ARTX 1000': 450,
      'ARTX 2000': 250
    }
  }

  getAssetFor(symbol) {
    return this.assets[symbol]
  }

  getContract(address, abi) {
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, abi, api.signer)
    return globalThis._contracts[address]
  }

  get listing() {
    return {
      price: listing => {
        const contract = this.getContract(listing, LISTING_ABI)
        return contract.getPrice()
      },
      createAddress: (gpu, tokenId) => {
        const { getCreate2Address, solidityPack, solidityKeccak256} = globalThis.ethers.utils
        return getCreate2Address(
          this.addresses.exchange,
          solidityKeccak256(['bytes'], [solidityPack(['address', 'uint256'], [gpu, tokenId])]),
          solidityKeccak256(['bytes'], [bytecode])
        )
      }
    }
  }

  get arteon() {
    const contract = this.getContract(api.addresses.exchange, EXCHANGE_ABI)
    return {

    }
  }

  get exchange() {
    return {
      buy: async (listing, tokenId) => {
        console.log({listing, tokenId});
        const exchangeContract = this.getContract(api.addresses.exchange, EXCHANGE_ABI)
        listing = await exchangeContract.callStatic.lists(listing)
        console.log(listing);
        const contract = api.getContract(api.addresses.token, ARTEON_ABI)
        const approve = await contract.approve(this.addresses.exchange, listing.price)
        await approve.wait()
        return exchangeContract.buy(listing.gpu, listing.tokenId, {gasLimit: 400000})
      }
    }
  }

  get token() {
    return {
      approve: (address, amount) => {
        const contract = this.getContract(api.addresses.token, ARTEON_ABI)
        return contract.approve(address, amount)
      }
    }
  }
}

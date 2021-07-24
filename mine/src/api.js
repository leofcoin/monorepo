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
      // this.signature = await signer.signMessage(`Arteon
      //   Give permission to sign messages?`)
      //
      //   console.log(this.signature);
    }

    return this
  }

  get assets() {
    return {
      cards: {
        GENESIS: './assets/cards/GENESIS-320.png',
        'ARTX 1000': './assets/cards/ARTX 1000-320.png',
        'ARTX 2000': './assets/cards/ARTX 2000-320.png',
        'XTREME': './assets/cards/XTREME-320.png'
      },
      fans: {
        GENESIS: './assets/fans/GENESIS.png',
        'ARTX 1000': './assets/fans/ARTX 1000.png',
        'ARTX 2000': './assets/fans/ARTX 2000.png',
        'XTREME': './assets/fans/XTREME.png'
      },
      fronts: {
        'XTREME': './assets/fronts/XTREME.png'
      },
      configs: {
        GENESIS: {
          fans: [
            ['4%', '30%', '76px', '76px'],
            ['35.5%', '30%', '76px', '76px'],
            ['68%', '30%', '76px', '76px']
          ] // x, y, h, w
        },
        'ARTX 1000': {
          fans: [
            ['44.5%', '33%', '48px', '48px'],
          ] // x, y, h, w
        },
        'ARTX 2000': {
          fans: [
            ['24%', '12.5%', '75px', '75px'],
            ['61.3%', '12.5%', '75px', '75px']
          ] // x, y, h, w
        },
        'XTREME': {
          fans: [
            ['11%', '12.5%', '80px', '80px'],
            ['37%', '15%', '75px', '75px', 1],
            ['61.3%', '12.5%', '80px', '80px']
          ], // x, y, h, w, id
          fronts: [
            ['21%', '6%', '76%', '60.5%']
          ]
        }
      }
    }
  }

  get maximumSupply() {
    return {
      GENESIS: 50,
      'ARTX 1000': 450,
      'ARTX 2000': 250,
      'XTREME': 133
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
      buy: async (gpu, tokenId, maxAllowance) => {
        let listing = await api.listing.createAddress(gpu, tokenId)
        const exchangeContract = this.getContract(api.addresses.exchange, EXCHANGE_ABI)
        listing = await exchangeContract.callStatic.lists(listing)
        if (maxAllowance.lt(listing.price)) return alert(`allowance ${maxAllowance.toString()} < price ${listing.price.toString()}`)

        const contract = api.getContract(api.addresses.token, ARTEON_ABI)
        let allowance = await contract.callStatic.allowance(this.signer.address, this.addresses.exchange)
        let approved;
        if (allowance.isZero()) approved = await contract.approve(this.addresses.exchange, maxAllowance)
        else if (allowance.lt(maxAllowance)) approved = await contract.increaseAllowance(this.addresses.exchange, maxAllowance.sub(allowance))
        else if (maxAllowance.lt(allowance)) approved = await contract.decreaseAllowance(this.addresses.exchange, allowance.sub(maxAllowance))

        if (approved) await approved.wait()
        return exchangeContract.buy(listing.gpu, listing.tokenId)
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

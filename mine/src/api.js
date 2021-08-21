import LISTING_ABI from './abis/listing.js'
import EXCHANGE_ABI from './abis/exchange.js'
import ARTEON_ABI from './abis/arteon.js'
import bytecode from './bytecodes/listing.js'
export default class Api {
  constructor(network, provider, signer) {
    this.network = network
    this.provider = provider
    // this.provider = new ethers.providers.EtherscanProvider(network, 'SVUVR9EZ8PPS9QTJ9MDNJFRGPWJXHB8BI4')
    if (!provider) return
    return this._init()
  }

  _loadScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.onload = () => resolve()
      script.onerror = () => reject()
      script.src = './third-party/matic.js'
      document.head.appendChild(script)
    });

  }

  async _init(signer) {
    await this._loadScript()
    this.maticPOSClient = new Matic.MaticPOSClient({
      network: this.network === 'polygon-testnet' ? 'testnet' : 'mainnet',
      version: this.network === 'polygon-testnet' ? 'mumbai': 'v1',
      parentProvider: this.provider,
      maticProvider: this.maticProvider
    })
    this.signer = await this.provider.getSigner()
    console.log(this.maticPOSClient);
    if (!this.signer.address) {
      this.signer.address = await this.signer.getAddress()
      pubsub.publish('account-change', this.signer.address)
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
            ['73.5%', '33%', '48px', '48px'],
          ] // x, y, h, w
        },
        'ARTX 2000': {
          fans: [
            ['25%', '12.5%', '75px', '75px'],
            ['63.3%', '12.5%', '75px', '75px']
          ] // x, y, h, w
        },
        'XTREME': {
          fans: [
            ['12%', '12.5%', '80px', '80px'],
            ['39%', '15%', '75px', '75px', 1],
            ['64.3%', '12.5%', '80px', '80px']
          ], // x, y, h, w, id
          fronts: [
            ['22%', '6%', '76%', '62.5%']
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

  getContract(address, abi, signer = false) {
    if (signer) {
      globalThis._contracts['signer'] = globalThis._contracts['signer'] = {}
      globalThis._contracts['signer'][address] = globalThis._contracts['signer'][address] || new ethers.Contract(address, abi, api.signer)
      return globalThis._contracts['signer'] [address]
    }
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, abi, api.provider)
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

  async _connectMetaMask() {
    const accounts = await ethereum.request({method: 'eth_requestAccounts'})
    const provider = new ethers.providers.Web3Provider(ethereum)
    this.signer = await provider.getSigner()
    if (!this.signer.address) {
      this.signer.address = await this.signer.getAddress()
    }
    pubsub.publish('account-change', this.signer.address)
  }

  get exchange() {
    return {
      buy: async (gpu, tokenId, maxAllowance) => {
        if (!ethereum) {
          alert('install metaMask')
          return
        }
        if (!this.signer) {
          await this._connectMetaMask()
        }
        let listing = await api.listing.createAddress(gpu, tokenId)
        const exchangeContract = this.getContract(api.addresses.exchange, EXCHANGE_ABI, true)
        listing = await exchangeContract.callStatic.lists(listing)
        if (maxAllowance.lt(listing.price)) return alert(`allowance ${maxAllowance.toString()} < price ${listing.price.toString()}`)

        const contract = api.getContract(api.addresses.token, ARTEON_ABI, true)
        const balance = await contract.callStatic.balanceOf(this.signer.address)
        if (balance.lt(listing.price)) {
        let response = await fetch(`https://ropsten.api.0x.org/swap/v1/price?buyAmount=${listing.price.sub(balance)}&buyToken=${api.addresses.token}&sellToken=ETH`)
        response = await response.json()
        const answer = await confirm(`NOT ENOUGH TOKENS

price exceeds balance

balance: ${Math.round(ethers.utils.formatUnits(balance, 18) * 100) / 100} ART
price: ${ethers.utils.formatUnits(listing.price, 18)} ART

Try buying using ETH?`)

          if (answer === false) return
          value = response.value
        }

        console.log(value);
        if (value > 0) await this.token.buy(value)

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

  async _addListing({address, tokenId, price, tokenIdTo}) {
    tokenIdTo = tokenIdTo || tokenId
    console.log({address, tokenId, price});
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, GPU_ABI, api.signer)

    const isApprovedForAll = await globalThis._contracts[address].callStatic.isApprovedForAll(api.signer.address, api.addresses.exchange)
    console.log(isApprovedForAll);
    if (!isApprovedForAll) {
      const approved = await globalThis._contracts[address].setApprovalForAll(api.addresses.exchange, true)
      await approved.wait()
    }
    let nonce = await api.signer.getTransactionCount()
    let promises = [];
    const exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI)
    for (let i = Number(tokenId); i <= Number(tokenIdTo); i++) {
      const listing = api.listing.createAddress(address, i)
      promises.push(exchangeContract.list(listing, address, i, ethers.utils.parseUnits(price, 18), {nonce: nonce++}))
    }
    promises = await Promise.all(promises)
    promises = promises.map(promise => promise.wait())
    promises = await Promise.all(promises)
  }

  async _changePrice({address, tokenId, price}) {

    const exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI)
    let tx = await exchangeContract.setPrice(address, tokenId, ethers.utils.parseUnits(price, 18))
    await tx.wait()
  }

  get token() {
    return {
      approve: (address, amount) => {
        const contract = this.getContract(api.addresses.token, ARTEON_ABI)
        return contract.approve(address, amount)
      },
      buy: (amount) => {

      }
    }
  }
}

import PLATFORM_ABI from './../../abis/platform.js'
import EXCHANGE_ABI from './../../abis/exchange.js'
import ARTONLINE_ABI from './../../abis/artonline.js'
import MINING_ABI from './../../abis/mining.js'
import bytecode from './bytecodes/listing.js'
import {rpcUrlFor} from './../../../network-connect/src/utils'

const cache = {}

export default class Api {
  constructor(network, provider, signer, addresses) {
    this.network = network
    this.provider = provider
    this.addresses = addresses
    // this.provider = new ethers.providers.EtherscanProvider(network, 'SVUVR9EZ8PPS9QTJ9MDNJFRGPWJXHB8BI4')
    if (!provider) return
    const timeout = () => {
      setTimeout(() => {
        for (var key of Object.keys(cache)) {
          delete cache[key]
        }
        timeout()
      }, 10000);
    }
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
    // this.maticPOSClient = new Matic.MaticPOSClient({
    //   network: this.network === 'polygon-testnet' ? 'testnet' : 'mainnet',
    //   version: this.network === 'polygon-testnet' ? 'mumbai': 'v1',
    //   parentProvider: this.provider,
    //   maticProvider: this.maticProvider
    // })
    this.signer = await this.provider.getSigner()
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
        GENESIS: 'https://assets.artonline.site/cards/GENESIS-320.png',
        'ARTX1000': 'https://assets.artonline.site/cards/ARTX 1000-320.png',
        'ARTX2000': 'https://assets.artonline.site/cards/ARTX 2000-320.png',
        'XTREME': 'https://assets.artonline.site/cards/XTREME-320.png',
        'MODULE': 'https://assets.artonline.site/cards/MODULE-320.png',
        'SPINNER': 'https://assets.artonline.site/fronts/SPINNER.png',
        'GOLDGEN': 'https://assets.artonline.site/cards/GOLDGEN-320.png',
        'SHIBOKI': 'https://assets.artonline.site/cards/SHIBOKI-320.png'
      },
      fans: {
        GENESIS: 'https://assets.artonline.site/fans/GENESIS.png',
        'ARTX1000': 'https://assets.artonline.site/fans/ARTX 1000.png',
        'ARTX2000': 'https://assets.artonline.site/fans/ARTX 2000.png',
        'XTREME': 'https://assets.artonline.site/fans/XTREME.png',
        'MODULE': 'https://assets.artonline.site/fans/MODULE.png',
        'SPINNER': 'https://assets.artonline.site/fans/SPINNER.png',
        'GOLDGEN': 'https://assets.artonline.site/fans/GOLDGEN.png',
        'SHIBOKI': 'https://assets.artonline.site/fans/SHIBOKI.png'
      },
      fronts: {
        'XTREME': 'https://assets.artonline.site/fronts/XTREME.png',
        'SHIBOKI': 'https://assets.artonline.site/fronts/SHIBOKI.png'
      },
      configs: {
        GENESIS: {
          fans: [
            ['4%', '30%', '76px', '76px'],
            ['35.5%', '30%', '76px', '76px'],
            ['68%', '30%', '76px', '76px']
          ] // x, y, h, w
        },
        'ARTX1000': {
          fans: [
            ['62.5%', '33%', '48px', '48px'],
          ] // x, y, h, w
        },
        'ARTX2000': {
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
        },
        'MODULE': {
          fans: [
            ['47.5%', '17%', '76px', '76px'],
          ] // x, y, h, w
        },
        'SPINNER': {
          fans: [
            ['35.5%', '17%', '80px', '80px']
          ]
        },
        GOLDGEN: {
          fans: [
            ['4%', '30%', '76px', '76px'],
            ['35.5%', '30%', '76px', '76px'],
            ['68%', '30%', '76px', '76px']
          ]
        },
        SHIBOKI: {
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
        const contract = this.getContract(api.addresses.platform, PLATFORM_ABI)
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
        const exchangeContract = this.getContract(api.addresses.platformProxy, PLATFORM_ABI, true)
        listing = await exchangeContract.callStatic.lists(listing)
        if (maxAllowance.lt(listing.price)) return alert(`allowance ${maxAllowance.toString()} < price ${listing.price.toString()}`)

        const contract = api.getContract(api.addresses.token, ARTONLINE_ABI, true)
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
    const contract = this.getContract(api.addresses.platform, PLATFORM_ABI)
    for (let i = Number(tokenId); i <= Number(tokenIdTo); i++) {
      const listing = api.listing.createAddress(address, i)
      promises.push(contract.list(listing, address, i, ethers.utils.parseUnits(price, 18), {nonce: nonce++}))
    }
    promises = await Promise.all(promises)
    promises = promises.map(promise => promise.wait())
    promises = await Promise.all(promises)
  }

  async _changePrice({address, tokenId, price}) {

    const contract = this.getContract(api.addresses.platform, PLATFORM_ABI)
    let tx = await contract.setPrice(address, tokenId, ethers.utils.parseUnits(price, 18))
    await tx.wait()
  }

  get token() {
    return {
      permit: async () => {
        const time = new Date().getTime()
        const deadline = time / 1000 + 86400 // 24 hrs

        const contract = api.getContract(api.addresses.artonline, ARTONLINE_ABI, api.signer)
        const nonces = await contract.nonces(api.signer.address)

        await contract.permit(api.signer.address, api.addresses.platform, ethers.utils.parseUnits('10000'), nonces, deadline)
      },
      approve: (address, amount) => {
        const contract = this.getContract(api.addresses.artonline, ARTONLINE_ABI)
        return contract.approve(address, amount)
      },
      buy: (amount) => {

      }
    }
  }

  get cards() {
    return ['GENESIS', 'ARTX1000', 'ARTX2000', 'XTREME', 'MODULE', 'SPINNER', 'GOLDGEN']
  }



  async calculateStock(id) {
    const exchangeContract = new ethers.Contract(api.addresses.exchange, EXCHANGE_ABI, this.signer)
    const platformContract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, this.signer)
    const supplyCap = await platformContract.cap(id)
    const totalSupply = await platformContract.totalSupply(id)
    return supplyCap.sub(totalSupply).toString()
  }

  async tokens() {
    if (!cache['tokens']) {
      const tokens = await this.getContract(this.addresses.platform, PLATFORM_ABI).callStatic.tokens()
      cache['tokens'] = tokens.map((name, i) => i)
    }
    return cache['tokens']
  }

  async tokenNames() {
    if (!cache['tokenNames']) {
      cache['tokenNames'] = await this.getContract(this.addresses.platform, PLATFORM_ABI).callStatic.tokens()
    }
    return cache['tokenNames']
  }

  async pools() {
    if (!cache['pools']) cache['pools'] = await this.getContract(this.addresses.mining, MINING_ABI).callStatic.pools()
    return cache['pools']
  }

  async items() {
    if (!cache['items']) cache['items'] = await this.getContract(this.addresses.mining, MINING_ABI).callStatic.items()
    return cache['items']
  }

  async poolNames() {
    if (!cache['tokenNames']) {
      const promises = await Promise.all([ await this.tokenNames(), await this.pools() ])
      return promises[1].map(id => [id.toNumber(), promises[0][id.toString()]])
    }
    const pools = await this.tokens()
    const names = await this.tokenNames()
    console.log(names, pools);
    return pools.map(id => [id, names[id]])
  }

  get platform() {
    return {
      contract: new ethers.Contract(api.addresses.platform, PLATFORM_ABI, api.signer ? api.signer : this.provider),
      balanceOfAll: async (address) => {
        const contract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, this.provider)
        const tokens = await this.tokens()
        return contract.callStatic.balanceOfBatch(
          tokens.map(item => address),
          tokens
        )
      }
    }
  }

  get mining() {
    return {
      contract: new ethers.Contract(api.addresses.mining, MINING_ABI, api.signer ? api.signer : this.provider),
    }
  }

  get timeout() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 500);
    })
  }

  get isHex() {
    return ethers.utils.isHexString
  }
  isEthereumAddress(address) {
    const hasPrefix = address.slice(0, 2) === '0x';
    // a prefixed eth address is 21 bytes long
    if (address.length > 42 || address.length < 40) return false
    // without prefix
    if (!hasPrefix && address.length === 40 && this.isHex(address)) return true
    // with prefix
    if (hasPrefix && address.length === 42 &&
      this.isHex(address)) return true
    // no other cases to handle
    return false
  }
}

import './../../node_modules/ethers/dist/ethers.esm'
import {rpcUrlsById, networksByName} from './../../node_modules/@arteon/wallet-connect/src/utils'
import './../../node_modules/@arteon/wallet-connect/dist/wallet-connect.browser'
import addresses from './../../../addresses/addresses'
// import LOTTERY_ABI from './../../../abis/lottery'
import LOTTERY from './../../../build/contracts/ArtOnlineLottery.json';
import ERC20_ABI from './../../../build/contracts/IERC20.json'
const LOTTERY_ABI = LOTTERY.abi
const NETWORK_NAME = 'binance-smartchain-testnet'
const NETWORK_ID = networksByName[NETWORK_NAME]
import TICKETS_ABI from './../../../abis/lotteryTickets'
globalThis.ethers = _ethers

export default class Api {
  constructor() {
    this._init()
    this._reload = this._reload.bind(this)
  }

  _reload() {
    location.reload()
  }

  async _init() {
    this.network = {
      chainid: NETWORK_ID,
      name: NETWORK_NAME,
      rpcUrl: rpcUrlsById[NETWORK_ID]
    }
    this.provider = new ethers.providers.JsonRpcProvider(this.network.rpcUrl, NETWORK_ID)
    this.addresses = await addresses(NETWORK_NAME)
    this.contract = new ethers.Contract(this.addresses.lotteryProxy, LOTTERY_ABI, this.provider)
    this.ticketsContract = new ethers.Contract(api.addresses.lotteryTickets, TICKETS_ABI, this.provider)
    if (globalThis.ethereum) {
      ethereum.on('accountsChanged', this._reload)
      ethereum.on('chainChanged', this._reload)
    }

    let wallet = localStorage.getItem('wallet')
    // let address =
    // await miniframe.load.script('https://cdn.jsdelivr.net/npm/jdenticon@3.1.0/dist/jdenticon.min.js', 'sha384-VngWWnG9GS4jDgsGEUNaoRQtfBGiIKZTiXwm9KpgAeaRn6Y/1tAFiyXqSzqC8Ga/', 'anonymous')
    if (wallet) {
      await this.connectWallet()
    // } else {
      // jdenticon.update(document.querySelector('exchange-shell').shadowRoot.querySelector('.avatar'), '0x0000000000000000000000000000000000000000')
    }

    if (!api.ready) {
      api.contract.on('LotteryClose', (id, winningNumbers, burns) => {
        console.log(winningNumbers);
        console.log('closed');
        location.hash = '#!/results'
      })

      api.contract.on('LotteryOpen', async (id) => {
        const info = await api.contract.lottery(id)
        const home = document.querySelector('lottery-shell').shadowRoot.querySelector('home-view')
        home._endTime = info.endTime.toNumber()
        home._id = info.id.toNumber()
        home._prizePool = info.prizePool
        home._userTicketCount = 0
        home.shadowRoot.querySelector('[info="tickets-sold"]').innerHTML = 0
      })

      api.contract.on('BuyTickets', async (buyer, id, numbers, amount) => {

        let promises = [
          api.contract.callStatic.lottery(id),
          api.ticketsContract.callStatic.totalSupply(id)
        ]

        promises = await Promise.all(promises)

        const home = document.querySelector('lottery-shell').shadowRoot.querySelector('home-view')
        home._prizePool = promises[0].prizePool

        if (buyer.toLowerCase() === api.connection.accounts[0].toLowerCase()) {
          home._userTicketCount = home._userTicketCount + amount.toNumber()
        }


        home.shadowRoot.querySelector('[info="tickets-sold"]').innerHTML = promises[1]
      })
      const art = new ethers.Contract(api.addresses.artonline, ERC20_ABI.abi, api.provider)
      art.on('Transfer', async (from, to, amount) => {
        if (from.toLowerCase() === api.contract.address.toLowerCase() && to.toLowerCase() === api.connection.accounts[0].toLowerCase()) {
          document.querySelector('lottery-shell').shadowRoot.querySelector('custom-toasts').addToast('You won', `${Math.round(ethers.utils.formatUnits(amount))} ART`)

        }
      })
    }
    this.ready = true
    pubsub.publish('api.ready', true)
  }

  async connectWallet() {
    let wallet = localStorage.getItem('wallet')
    if (wallet) {
      wallet = JSON.parse(wallet)
      this.walletType = wallet.type
    } else {
      const dialog = document.querySelector('lottery-shell').shadowRoot.querySelector('connect-element');
      const result = await dialog.show()
      this.walletType = dialog.querySelector('custom-selector').selected
      localStorage.setItem('wallet', JSON.stringify({
        type: this.walletType
      }))
    }
    this.connection = await walletConnect.connect({
      chainId: NETWORK_ID,
      name: NETWORK_NAME
    })
    // jdenticon.update(document.querySelector('exchange-shell').shadowRoot.querySelector('.avatar'), this.connection.accounts[0])
    this.contract = new ethers.Contract(this.addresses.lotteryProxy, LOTTERY_ABI, this.connection.provider.getSigner())


  }

  async getPrice() {
    let response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=artonline&vs_currencies=usd')
    response = await response.json()
    return response.artonline.usd

  }

  async getAllTickets() {
    const lotteries = await api.contract.callStatic.lotteries()
    const contract = new ethers.Contract(api.addresses.lotteryTickets, TICKETS_ABI, api.connection.provider.getSigner())
    const ids = []
    const accounts = []
    for (let i = 1; i <= lotteries.toNumber(); i++) {
      ids.push(i)
      accounts.push(api.connection.accounts[0])
    }
    let balances = await contract.balanceOfBatch(accounts, ids)
    let i = 0
    balances = balances.reduce((p, c) => {
      i++
      if (c.toNumber() > 0) p.push({lotteryId: i, tickets: c.toNumber()})
      return p
    }, [])
    return balances
  }

  async getBalance(lottery) {
    const balance = await this.ticketsContract.balanceOf(api.connection.accounts[0], lottery)
    return balance
  }

  async getTickets(lottery) {
    return this.ticketsContract.tickets(lottery, api.connection.accounts[0])
  }

  async getTicketNumbers(lottery, ticket) {
    return this.ticketsContract.getTicketNumbers(lottery, ticket)
  }
}

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
    this.ready = true
    pubsub.publish('api.ready', true)
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
  }

  async connectWallet() {
    let wallet = localStorage.getItem('wallet')
    if (wallet) {
      wallet = JSON.parse(wallet)
      this.walletType = wallet.type
    } else {
      const dialog = document.querySelector('exchange-shell').shadowRoot.querySelector('connect-element');
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
}

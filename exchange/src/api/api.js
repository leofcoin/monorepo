import './../../node_modules/ethers/dist/ethers.esm'
import {rpcUrlsById, networksByName} from './../../node_modules/@arteon/wallet-connect/src/utils'
import './../../node_modules/@arteon/wallet-connect/dist/wallet-connect.browser'
import addresses from './../../../addresses/addresses'
import EXCHANGE_FACTORY_ABI from './../../../abis/exchangeFactory'
import ERC20_ABI from './../../../build/contracts/IERC20.json'

const NETWORK_NAME = 'binance-smartchain'
const NETWORK_ID = networksByName[NETWORK_NAME]

globalThis.ethers = _ethers

export default class Api {
  constructor() {
    this._init()
  }

  async _init() {
    this.network = {
      chainid: NETWORK_ID,
      name: NETWORK_NAME,
      rpcUrl: rpcUrlsById[NETWORK_ID]
    }
    this.provider = new ethers.providers.JsonRpcProvider(this.network.rpcUrl, NETWORK_ID)
    this.addresses = await addresses(NETWORK_NAME)
    this.contract = new ethers.Contract(this.addresses.exchangeFactory, EXCHANGE_FACTORY_ABI, this.provider)
    pubsub.publish('api.ready', true)

    let wallet = localStorage.getItem('wallet')
    let address =
    await miniframe.load.script('https://cdn.jsdelivr.net/npm/jdenticon@3.1.0/dist/jdenticon.min.js', 'sha384-VngWWnG9GS4jDgsGEUNaoRQtfBGiIKZTiXwm9KpgAeaRn6Y/1tAFiyXqSzqC8Ga/', 'anonymous')
    if (wallet) {
      await this.connectWallet()
    } else {
      jdenticon.update(document.querySelector('exchange-shell').shadowRoot.querySelector('.avatar'), '0x0000000000000000000000000000000000000000')
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
    jdenticon.update(document.querySelector('exchange-shell').shadowRoot.querySelector('.avatar'), this.connection.accounts[0])
    this.contract = new ethers.Contract(this.addresses.exchangeFactory, EXCHANGE_FACTORY_ABI, this.connection.provider.getSigner())
  }

  async approve(contract, amount) {
    if (typeof contract === 'string') contract = new ethers.Contract(contract, ERC20_ABI.abi, this.connection.provider.getSigner())
    let tx = await contract.approve(api.addresses.exchangeFactory, amount)
    await tx.wait()
  }

  async isApproved(contract, amount) {
    if (typeof contract === 'string') contract = new ethers.Contract(contract, ERC20_ABI.abi, this.connection.provider.getSigner())
    const allowance = await contract.callStatic.allowance(api.connection.accounts[0], api.addresses.exchangeFactory)
    if (allowance.lt(amount)) return false
    return true
  }
}

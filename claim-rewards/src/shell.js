import './../node_modules/@andrewvanardennen/custom-input/custom-input'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import './../node_modules/custom-pages/src/custom-pages'
import './../node_modules/ethers/dist/ethers.esm'
import addresses from './../../addresses/addresses/binance-smartchain'
import ABI from './../../abis/miner.js'
import PLATFORM_ABI from './../../abis/platform.js'


const firebaseConfig = {
  apiKey: "AIzaSyCwWiyzJJqNgX1O7R-N-8dIlB3HFnwji40",
  authDomain: "claimartrewards.firebaseapp.com",
  databaseURL: "https://claimartrewards-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "claimartrewards",
  storageBucket: "claimartrewards.appspot.com",
  messagingSenderId: "336643526293",
  appId: "1:336643526293:web:57f5b245cc9cecd5ad959c"
};

// Initialize Firebase
globalThis.firebase = firebase.initializeApp(firebaseConfig);

globalThis.ethers = _ethers

export default customElements.define('claim-shell', class ClaimShell extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this._render()
    this._claim = this._claim.bind(this)
    this._loadAccounts = this._loadAccounts.bind(this)
  }

  connectedCallback() {
    this.shadowRoot.querySelector('button').addEventListener('click', this._claim)

    this._init()
  }

  async _loadAccounts() {
    const provider = new ethers.providers.Web3Provider(globalThis.ethereum, {
      chainId: 56
    })

    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    })
    this.signer = provider.getSigner()
    this.address = accounts[0]
  }

  async _init() {
    if (globalThis.ethereum) {
      ethereum.on('accountsChanged', this._loadAccounts)
      ethereum.on('chainChanged', this._loadAccounts)
      await this._loadAccounts()
      const claimable = await this._calculateClaimable()

      const value = await firebase.database().ref(`addresses/bnb/${this.address}`).once('value')
      if (!value.val()) {
        this.shadowRoot.querySelector('.claimable').innerHTML = claimable
      } else {
        this.shadowRoot.querySelector('.claimable').innerHTML = value.val()
        this.shadowRoot.querySelector('button').innerHTML = 'already claimed'
      }
    } else {
      setTimeout(() => {
        this.shadowRoot.querySelector('.install-wallet').setAttribute('shown', '')
      }, 500)
    }
  }

  async _calculateClaimable() {
    this.contract = new ethers.Contract('0x9D0F9765c2e912088b682DA9eaf7439a9440a6e4', PLATFORM_ABI, this.signer)
    let claimable = ethers.BigNumber.from(0)
    let i = 0
    const ids = [0, 1, 2, 3, 4]
    for (const id of ids) {
      const earned = await this.contract.callStatic.earned(this.address, id)
      claimable = claimable.add(earned)
      i++
    }

    return ethers.utils.formatUnits(claimable)
  }

  async _claim() {
    const claimable = await this._calculateClaimable()
    await firebase.database().ref(`addresses/bnb/${this.address}`).set(claimable)
  }

  _render() {
    this.shadowRoot.innerHTML = `
    <style>
      :host {
        font-family: 'Noto Sans', sans-serif;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        color: aliceblue;
      }

      button {
        height: 44px;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        padding: 12px 24px;
        box-sizing: border-box;
        background: #ba68c8;
        border: none;
        color: aliceblue;
      }

      .toolbar {
        box-sizing: border-box;
        padding: 12px 24px;
      }

      h1 {
        margin: 0;
        padding: 0;
        color: aliceblue;
      }
      .install-wallet {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: absolute;
        box-sizing: border-box;
        padding: 12px 24px;
        bottom: 0;
        left: 0;
        right: 0;
        height: 80px;
        opacity: 0;
        transform: translateY(105%);
        background: rgba(0,0,0,0.58);
        color: aliceblue;
      }
      .install-wallet[shown] {
        opacity: 1;
        transform: translateY(0);
        transition: opacity 240ms ease-in, transform 120ms ease-in;
        z-index: 100;
      }

      a {
        text-decoration: none;
      }

      .install-wallet a {
        color: #3375bb;
        padding: 0 6px;
        cursor: pointer;
        pointer-events: auto !important;
      }

      busy-animation {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      @media (min-width: 620px) {
        .install-wallet {
          flex-direction: row;
          height: 40px;
        }
      }
    </style>
    <flex-row class="toolbar">
      <h1>ARTONLINE</h1>
    </flex-row>
    <main>
      <p class="claimable"></p>
      <button>claim</button>
    </main>

    <span class="install-wallet">
      <flex-row>Install a web3 supported wallet like</flex-row>
      <flex-row><a style="color: #f5841f;" href="https://metamask.io/download.html">MetaMask</a> or<a href="https://trustwallet.com/download-page">Trust Wallet</a></flex-row>
    </span>
    `
  }
})

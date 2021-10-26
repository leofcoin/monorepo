import './../elements/custom-hero'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'

export default customElements.define('buy-view', class BuyView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        custom-input {
          box-shadow: none;
          min-width: auto;
          pointer-events: auto;
        }

        .get {
          box-sizing: border-box;
          padding: 12px 6px;
        }

        .input-section {
          align-items: center;
          box-sizing: border-box;
          box-shadow: 0px 1px 3px -1px #333;
          padding-right: 12px;
          border-radius: 12px;
        }

        .for {
          padding: 12px 6px 0 6px;
        }

        .for-section {
          align-items: center;
          box-sizing: border-box;
          padding: 0 6px 12px 6px;
        }
        button {
          background: transparent;
          height: 44px;
          border-radius: 12px;
          cursor: pointer;
          pointer-events: auto;
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
          color: aliceblue;
        }

        .install-wallet a {
          color: #3375bb;
          padding: 0 6px;
          cursor: pointer;
          pointer-events: auto !important;
        }
      </style>
      <custom-hero>
        <strong class="get">GET</strong>
        <flex-row class="input-section">
          <custom-input value="43478" data-name="ART"></custom-input>
          <strong>ART</strong>
        </flex-row>
        <flex-column>
          <strong class="for">FOR</strong>
          <flex-row class="for-section">
            <custom-input value="1" data-name="BNB"></custom-input>
            <strong>BNB</strong>
          </flex-row>
        </flex-column>
        <flex-column class="price"></flex-column>
        <flex-one></flex-one>
        <button>BUY</button>
      </custom-hero>

      <span class="install-wallet">
        <flex-row>Install a web3 supported wallet like</flex-row>
        <flex-row><a style="color: #f5841f;" href="https://metamask.io/download.html">MetaMask</a> or<a href="https://trustwallet.com/download-page">Trust Wallet</a></flex-row>
      </span>
    `
  }

  connectedCallback() {
    this._oninput = this._oninput.bind(this)
    this._buy = this._buy.bind(this)

    this._bnbInput = this.shadowRoot.querySelector('[data-name="BNB"]')
    this._artInput = this.shadowRoot.querySelector('[data-name="ART"]')

    this._bnbInput.addEventListener('input', this._oninput)
    this._artInput.addEventListener('input', this._oninput)
    this.shadowRoot.querySelector('button').innerHTML = 'connect wallet'
    this.shadowRoot.querySelector('button').addEventListener('click', this._buy)
  }

  async _loadAccounts() {
    const provider = new ethers.providers.Web3Provider(globalThis.ethereum, {
      chainId: 56
    })

    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    })

    api.signer = provider.getSigner()
    api.signer.address =accounts[0]
  }

  async _buy() {
    if (!this.connected) {
      if (globalThis.ethereum) {
        ethereum.on('accountsChanged', this._loadAccounts)
        ethereum.on('chainChanged', this._loadAccounts)
        await this._loadAccounts()
      } else {
        setTimeout(() => {
          this.shadowRoot.querySelector('.install-wallet').setAttribute('shown', '')
        }, 500)
      }
      this.connected = true
      this.shadowRoot.querySelector('button').innerHTML = 'buy'
      return
    }
    const amount = this._artInput.input.value
    const response = await fetch(`https://bsc.api.0x.org/swap/v1/quote?buyAmount=${ethers.utils.parseUnits(amount, 18)}&buyToken=${api.addresses.artonline}&sellToken=BNB`)
    const quote = await response.json()
    const tx = await api.signer.sendTransaction({
      to: quote.to,
      value: ethers.BigNumber.from(quote.value),
      data: quote.data
    })
    await tx.wait()
  }

  async _oninput(event) {
    const target = event.composedPath()[2]
    this._timeout && clearTimeout(this._timeout)

    this._timeout = () => setTimeout(async() => {
      let response
      let price
      let protocol
      if (target.dataset.name === 'BNB') {
        response = await fetch(`https://bsc.api.0x.org/swap/v1/price?sellAmount=${ethers.utils.parseUnits(this._bnbInput.input.value, 18)}&buyToken=${api.addresses.artonline}&sellToken=BNB`)
        price = await response.json()
        protocol = price.sources.filter(protocol => protocol.proportion === '1')[0]
        price = ethers.utils.formatUnits(price.buyAmount, 18)
        this._artInput.input.value = price
      } else if (target.dataset.name === 'ART') {
        response = await fetch(`https://bsc.api.0x.org/swap/v1/price?buyAmount=${ethers.utils.parseUnits(this._artInput.input.value, 18)}&buyToken=${api.addresses.artonline}&sellToken=BNB`)
        price = await response.json()
        protocol = price.sources.filter(protocol => protocol.proportion === '1')[0]
        price = ethers.utils.formatUnits(price.sellAmount, 18)
        this._bnbInput.input.value = price
      }
      this.shadowRoot.querySelector('.price').innerHTML = `
      <span style="height: 40px;padding: 12px 0; box-sizing: border-box;">${protocol.name}</span>
      <flex-one></flex-one>
      `
    }, 400);

    this._timeout()
  }
})

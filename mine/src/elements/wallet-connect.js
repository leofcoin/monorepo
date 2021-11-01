import './../../node_modules/@vandeurenglenn/custom-select/custom-select'
import ART_ONLINE_ABI from './../../../abis/artonline'
import arteonAddresses from './../../../addresses/addresses'

export default customElements.define('wallet-connect', class WalletConnect extends HTMLElement {
  get DEFAULT_NETWORK() {
    return 'binance-smartchain'
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _networkSelect() {
    return this.shadowRoot.querySelector('custom-select')
  }

  get _passwordInput() {
    return this.shadowRoot.querySelector('custom-input[placeholder="password"]')
  }

  get _dropdownEl() {
    return this.shadowRoot.querySelector('.dropdown')
  }

  get network() {
    const network = this._networkSelect.selected || DEFAULT_NETWORK
    if (network === 'ethereum') return 'mainnet'
    if (network === 'ethereum-testnet') return 'goerli'
    if (network === 'polygon-testnet') return 'polygon-mumbai'
    if (network === 'polygon') return 'polygon-mainnet'
    return network
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    let network = localStorage.getItem('last-selected-network')
    if (network === 'mainnet') network = 'ethereum'
    if (network === 'goerli') network = 'ethereum-testnet'
    this._networkSelect.selected =  network || this.DEFAULT_NETWORK

    this._onclick = this._onclick.bind(this)
    this._reload = this._reload.bind(this)
  }

  connectedCallback() {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jdenticon@3.1.0/dist/jdenticon.min.js'
    script.setAttribute('async', '')
    script.setAttribute('integrity', 'sha384-VngWWnG9GS4jDgsGEUNaoRQtfBGiIKZTiXwm9KpgAeaRn6Y/1tAFiyXqSzqC8Ga/')
    script.setAttribute('crossorigin', 'anonymous')

    document.head.appendChild(script)
    ethereum.on('accountsChanged', this._reload)
    ethereum.on('chainChanged', this._reload)
    this.addEventListener('click', this._onclick)
    this._networkSelect.addEventListener('selected', async () => {
      localStorage.setItem('last-selected-network', this.network)
      const connection = await walletConnect.connect(this.network)
    })
    this._init()
  }

  async _init() {
    const account = localStorage.getItem('last-selected')
    if (account) {
      this.connect()
    }
  }

  async connect() {
    this.connection = await walletConnect.connect(this.network)
    this.shadowRoot.querySelector('button').innerHTML = `
    <strong class="address">${this.connection.accounts[0].slice(0, 6)}...${this.connection.accounts[0].slice(this.connection.accounts[0].length -5, this.connection.accounts[0].length)}</strong>
    <canvas class="avatar"></canvas>
    `

    const address = this.connection.accounts[0]
    const addresses = await arteonAddresses(this.network)

    jdenticon.update(this.shadowRoot.querySelector('.avatar'), this.connection.accounts[0])
    localStorage.setItem('last-selected', this.connection.accounts[0])

    const contract = new ethers.Contract(addresses.artonline, ART_ONLINE_ABI, this.connection.provider)
    let allowance = await contract.callStatic.allowance(address, addresses.platform)
    this.shadowRoot.querySelector('custom-input').setAttribute('value', ethers.utils.formatUnits(allowance, 18).toString())


    return this.connection
  }

  _reload() {
    globalThis.location.reload()
  }

  dropdown() {
    this._dropdownEl.hasAttribute('dropped') ?
      this._dropdownEl.removeAttribute('dropped') :
      this._dropdownEl.setAttribute('dropped', '')
  }

  async _onclick(event) {
    const el = event.composedPath()[0]
    console.log(el);
    if (el.hasAttribute('data-action')) {
      switch (el.getAttribute('data-action')) {
        case 'dropdown':
          this.dropdown()
          break;
        case 'changeAllowance':
          const contract = api.getContract(api.addresses.artonline, ART_ONLINE_ABI, api.signer)
          let newAllowance = this.shadowRoot.querySelector('custom-input').value
          newAllowance = ethers.utils.parseUnits(newAllowance, 18)
          let approved;
          let allowance = await contract.callStatic.allowance(api.signer.address, api.addresses.platform)
          if (allowance.isZero()) approved = await contract.approve(api.addresses.platform, newAllowance)
          else if (allowance.lt(newAllowance)) approved = await contract.increaseAllowance(api.addresses.platform, newAllowance.sub(allowance))
          else if (newAllowance.lt(allowance)) approved = await contract.decreaseAllowance(api.addresses.platform, allowance.sub(newAllowance))

          if (approved) await approved.wait()
          break;
        case 'connect':
          if (el.getAttribute('data-route') === 'arteon') {
            await this._pages.select('select-option')
          } else {
            this.connection = await walletConnect.connect(this.network)
            console.log(this.connection);
            localStorage.setItem('last-selected', this.connection.accounts[0])
            this.shadowRoot.querySelector('button').innerHTML = `
            <strong class="address">${this.connection.accounts[0].slice(0, 6)}...${this.connection.accounts[0].slice(this.connection.accounts[0].length -5, this.connection.accounts[0].length)}</strong>
            <canvas class="avatar"></canvas>
            `
            jdenticon.update(this.shadowRoot.querySelector('.avatar'), this.connection.accounts[0])
          }
          break;
        case 'create':
          const wallet = ethers.Wallet.createRandom()
          const encrypted = await wallet.encrypt(this._passwordInput.value)
          localStorage.setItem(uid, wallet.mnemonic.phrase)
          break;

      }
    }

  }
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        display: flex;
        height: 40px;
        min-width: 86px;
        flex-direction: row;
        align-items: center;
      }
      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
        height: inherit;
        pointer-events: auto;
        cursor: pointer;
      }
      [data-route="connect"] button {
        // min-width: 158px;
      }
      .dropdown {
        opacity: 0;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 200px;
        max-width: 280px;
        max-height: 320px;
        position: absolute;
        top: 64px;
        right: 24px;
        background: var(--main-background-color);
        box-sizing: border-box;
        border: 1px solid var(--accent-color);
        border-radius: 12px;
        z-index: 1000;
      }

      .container {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        height: 100%;
        width: 100%;

        box-sizing: border-box;
        padding: 0 12px 12px;
      }

      [dropped] {
        opacity: 1;
        pointer-events: auto;
      }

       custom-select flex-row {
         width: 100%;
         box-sizing: border-box;
         padding: 4px;
         height: 28px;
       }
       custom-select {
         background: var(--accent-color);
         padding-right: 12px;
         height: 26px;
         border-top-left-radius: 10px;
         border-top-right-radius: 10px;
       }

       button strong {
         padding-left: 12px;
       }

       .container flex-column {
         height: 100%;
       }
       .header {
         background: var(--accent-color);

         border-top-left-radius: 10px;
         border-top-right-radius: 10px;
       }

       [data-route="select-option"] .container {
         align-items: center;
       }
       .avatar {
         max-height: 30px;
         border-radius: 50%;
         position: absolute;
         right: 24px;
         z-index: 1000;
       }
       strong.address {
         padding-left: 0;
         padding-right: 36px;
       }

       [data-action="dropdown"] {
         font-size: 16px;
         font-weight: 500;
       }

       h4 {
         margin: 0;
         text-transform: uppercase;
       }

       custom-input {
         pointer-events: auto;
         --custom-input-color: #fff;
       }
    </style>
    <button data-action="dropdown">connect</button>

    <span class="dropdown">
      <flex-row class="header">
        <flex-one></flex-one>
        <custom-select attr-for-selected="data-route" right>

          <flex-row data-route="binance-smartchain">
            <span>binance-smartchain</span>
          </flex-row>

          <!--
          <flex-row data-route="ethereum">
            <span>ethereum</span>
          </flex-row>

          <flex-row data-route="ethereum-testnet">
            <span>ethereum-testnet</span>
          </flex-row>
          -->
          <flex-row data-route="binance-smartchain-testnet">
            <span>binance-smartchain-testnet</span>
          </flex-row>

          <flex-row data-route="art-ganache">
            <span>art-ganache</span>
          </flex-row>
        </custom-select>
      </flex-row>
      <custom-pages attr-for-selected="data-route">
        <flex-column data-route="connect">

          <span class="container">
            <flex-column>
              <flex-one></flex-one>
              <!-- <button data-action="connect" data-route="metaMask">
                <img src="./assets/metamask-fox.svg"></img>
                <strong>metaMask</strong>
              </button>
              -->
                <h4>allowance</h4>
                <custom-input value="0"></custom-input>
              <flex-one></flex-one>
              <flex-row>
                <flex-one></flex-one>
                <button class="allowance" data-action="changeAllowance">Approve</button>
                <flex-one></flex-one>
              </flex-row>
              <!--
               <button data-action="connect" data-route="arteon">
                <img src="./assets/arteon.svg" style="width: 30px;"></img>
                <strong>Arteon</strong>
              </button> -->
            </flex-column>
          </span>
        </flex-column>

        <flex-column data-route="select-option">
          <span class="container">
            <flex-column>
              <custom-input placeholder="password/mnemonic"></custom-input>
              <button>login</button>
              <flex-one></flex-one>
              <button>create</button>
              <flex-one></flex-one>
              <button>import</button>
            </flex-column>
          </span>
        </flex-column>

        <flex-column data-route="login">
          <custom-input placeholder="uid"></custom-input>
          <custom-input placeholder="password"></custom-input>
          <button>login</button>

        </flex-column>
        <flex-column data-route="switch">
          <custom-tabs>
            <custom-tab>MATIC</custom-tab>
            <custom-tab>ETH</custom-tab>
          </custom-tabs>

          <custom-tabs>
            <custom-tab>mainnet</custom-tab>
            <custom-tab>testnet</custom-tab>
          </custom-tabs>

          <button>switch</button>
        </flex-column>
      </custom-pages>


    </span>
      `
  }
})

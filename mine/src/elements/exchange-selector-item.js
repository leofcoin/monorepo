import EXCHANGE_ABI from './../abis/exchange'
import GPU_ABI from './../abis/gpu'
import {elevation4dp} from '../styles/elevation'
import {rotate, rotateBack} from '../styles/shared'
import './gpu-img'
export default customElements.define('exchange-selector-item', class ExchangeSelectorItem extends HTMLElement {

  static get observedAttributes() {
    return ['address']
  }

  get _buybutton() {
    return this.shadowRoot.querySelector('button')
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})

    this._ownerActions = ''
    this.asset = 'assets/arteon.svg'
    this.price = '0'
    this.shadowRoot.innerHTML = this.template
  }
  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value
  }

  set address(address) {
    this._observer()
  }

  get address() {
    return this.getAttribute('address')
  }

  set isOwner(isOwner) {
    this._observer()
  }

  get isOwner() {
    return this.getAttribute('is-owner')
  }

  _observer() {
    if (!this.address) return

    this._render(this.address)
  }

  async _render(address, isOwner) {
    const contract = api.getContract(address, GPU_ABI)
    this.symbol = await contract.callStatic.symbol()
    const exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI)
    const length = await exchangeContract.callStatic.gpuListingLength(address)

    if (isOwner) this._ownerSetup()
    let promises = []
    for (var i = 0; i < length; i++) {
      promises.push(exchangeContract.callStatic.gpuListing(address, i))
    }

    promises = await Promise.all(promises)
    promises = promises.map(address => exchangeContract.lists(address))
    promises = await Promise.all(promises)
    const lists = promises
    promises = promises.filter(promise => promise.listed === true)
    this.stock = String(promises.length)
    if (promises.length === 0) {
      // show last price
      this.price = lists.length > 0 ? ethers.utils.formatUnits(lists[lists.length - 1].price, 18) : '0'
      this.shadowRoot.innerHTML = this.template
      this._buybutton.innerHTML = 'OUT OF STOCK'
      this._buybutton.setAttribute('disabled', '')
    } else {
      this.price = lists.length > 0 ? ethers.utils.formatUnits(lists[lists.length - 1].price, 18) : '0'
      this.shadowRoot.innerHTML = this.template

      this._buybutton.addEventListener('click', async () => {
        const exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI)
        const length = await exchangeContract.callStatic.gpuListingLength(this.address)

        let promises = []
        for (var i = 0; i < length; i++) {
          promises.push(exchangeContract.callStatic.gpuListing(this.address, i))
        }

        promises = await Promise.all(promises)
        promises = promises.map(address => exchangeContract.lists(address))
        promises = await Promise.all(promises)
        promises = promises.filter(promise => promise.listed === true)
        const listing = promises[0];
        api.exchange.buy(listing.gpu, listing.tokenId, listing.price)
      })
    }
    exchangeContract.on('Delist', (gpu, tokenId) => {
      if (gpu !== this.address) return;

      this.stock = String(Number(this.stock) - 1)
      this.shadowRoot.innerHTML = this.template
    })

    this.exchangeContract.on('ListingCreated', (gpu, tokenId, listing, index, price) => {
      if (gpu !== this.address) return;

      this.stock = String(Number(this.stock) + 1)
      this.shadowRoot.innerHTML = this.template
    })
  }

  _ownerSetup() {
  }

  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        position: relative;
        display: flex;

        flex-direction: column;
        max-width: 320px;
        max-height: 274px;
        min-height: 274px;
        height: 100%;
        width: 100%;
        align-items: center;
        padding: 12px 0 20px 0;
        color: var(--main-color);
      }

      .container {
        display: flex;
        flex-direction: column;
        width: calc(100% - 6px);
        border-radius: 24px;
        max-height: 274px;
        min-height: 274px;
        height: 100%;
        border: 1px solid #eee;
        align-items: center;
        box-sizing: border-box;
        padding: 12px 0;
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
        height: 40px;
        min-width: 86px;
        pointer-events: auto;
        cursor: pointer;
      }

      img {
        max-height: 154px;
        max-width: 274px;
        width: 100%;
        height: 100%;
      }

      flex-row {
        align-items: center;
      }

      :host([sold="true"]) {
        opacity: 0.48;
        pointer-events: none;
        transition: opacity 120ms, transform 120ms;
      }

      custom-svg-icon {
        pointer-events: auto;
        cursor: pointer;
      }

      button {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        background: var(--main-background-color);
      }
      [disabled] {
        pointer-events: none;
        cursor: default;
        opacity: 0.78;
      }
      ${rotate}
      ${rotateBack}
    </style>
    <span class="container">
      ${this.symbol ? `<gpu-img symbol="${this.symbol}"></gpu-img>` : '<img src="./assets/arteon.svg"></img>'}
      <flex-one></flex-one>
      <flex-row>
        <span>${this.symbol ? this.symbol : 'loading'}</span>
      </flex-row>
      <flex-row>
        <span>${this.price ? this.price : 'loading'}</span>
        <strong style="padding-left: 6px">ART</strong>
      </flex-row>
      <flex-row>
        <span>${this.stock ? this.stock : 'loading'}</span>
        <strong style="padding-left: 6px">in stock  </strong>
      </flex-row>
      <flex-two></flex-two>

    </span>

    <button>BUY</button>
      `
  }
})

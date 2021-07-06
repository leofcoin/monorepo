import EXCHANGE_ABI from './../abis/exchange'
import GPU_ABI from './../abis/gpu'
import {elevation4dp} from '../styles/elevation'
import './gpu-img'
export default customElements.define('exchange-item', class ExchangeItem extends HTMLElement {

  static get observedAttributes() {
    return ['listing', 'sold']
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})

    this._ownerActions = ''
    this.asset = 'assets/arteon.svg'
    this.price = '0'
    this.symbol = 'ART'
    this.tokenId = '1'

    this.shadowRoot.innerHTML = this.template
  }

  connectedCallback() {

  }

  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value
  }

  set sold(value) {
    if (value) {
      const button = this.shadowRoot.querySelector('button')
      button.dataset.action = 'sold'
      button.innerHTML = 'SOLD'
    }

  }

  set listing(listing) {
    this._observer()
  }

  get listing() {
    return this.getAttribute('listing')
  }

  set isOwner(isOwner) {
    this._observer()
  }

  get isOwner() {
    return this.getAttribute('is-owner')
  }

  _observer() {
    if (!this.listing || this.isOwner === undefined) return

    this._render(this.listing, Boolean(this.isOwner === 'true'))
  }

  async _render(listing, isOwner) {

    globalThis._contracts[api.addresses.exchange] = globalThis._contracts[api.addresses.exchange] || new ethers.Contract(api.addresses.exchange, EXCHANGE_ABI, api.signer)
    const exchangeContract = globalThis._contracts[api.addresses.exchange]
    listing = await exchangeContract.callStatic.lists(listing)

    globalThis._contracts[listing.gpu] = globalThis._contracts[listing.gpu] || new ethers.Contract(listing.gpu, GPU_ABI, api.signer)
    this.symbol = await globalThis._contracts[listing.gpu].callStatic.symbol()
    this.tokenId = listing.tokenId.toString()
    this.price = ethers.utils.formatUnits(listing.price, 18)


    this._ownerActions = isOwner ? `
      <flex-row class="owner-actions">
        <!--<custom-svg-icon data-listing="${this.listing}" icon="add-shopping-cart"></custom-svg-icon>
        <custom-svg-icon data-listing="${this.listing}" icon="remove-shopping-cart"></custom-svg-icon>-->
        <custom-svg-icon data-action="changePrice" data-listing="${this.listing}" icon="attach-money"></custom-svg-icon>
        <flex-one></flex-one>
        <custom-svg-icon data-action="delist" data-listing="${this.listing}" icon="delete"></custom-svg-icon>
      </flex-row>
      ` : ''

    this.shadowRoot.innerHTML = this.template
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
        box-sizing: border-box;
        padding: 12px 24px 12px 24px;
        max-width: 320px;
        max-height: 274px;
        min-height: 274px;
        height: 100%;
        width: 100%;
        background: rgba(225,225,225,0.12);
        border-radius: 24px;
        ${elevation4dp}
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


      @-webkit-keyframes rotation {
        from {
          -webkit-transform: rotate(0deg);
          -o-transform: rotate(0deg);
          transform: rotate(0deg);
        }
        to {
          -webkit-transform: rotate(360deg);
          -o-transform: rotate(360deg);
          transform: rotate(360deg);
        }
      }
      @keyframes rotation {
        from {
          -ms-transform: rotate(0deg);
          -moz-transform: rotate(0deg);
          -webkit-transform: rotate(0deg);
          -o-transform: rotate(0deg);
          transform: rotate(0deg);
        }
        to {
          -ms-transform: rotate(360deg);
          -moz-transform: rotate(360deg);
          -webkit-transform: rotate(360deg);
          -o-transform: rotate(360deg);
          transform: rotate(360deg);
        }
      }
    </style>
    ${this._ownerActions}
    <flex-row>
      <span>${this.symbol}</span>
      <flex-one></flex-one>
      <strong>${this.tokenId}</strong>
    </flex-row>
    <gpu-img symbol="${this.symbol}"></gpu-img>
    <flex-one></flex-one>
    <flex-row>
      <span>${this.price}</span>
      <strong>ART</strong>
      <flex-one></flex-one>
      <button data-action="buy" data-listing="${this.listing}" data-id="${this.tokenId}">BUY</button>
    </flex-row>
      `
  }
})

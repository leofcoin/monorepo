import EXCHANGE_ABI from './../abis/exchange'
import GPU_ABI from './../abis/gpu'
import {elevation4dp} from '../styles/elevation'
import './gpu-img'
export default customElements.define('exchange-item', class ExchangeItem extends HTMLElement {

  static get observedAttributes() {
    return ['gpu', 'price', 'symbol', 'token-id', 'owner', 'sold']
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})

    this._ownerActions = ''

    this.shadowRoot.innerHTML = this.template
  }

  attributeChangedCallback(name, old, value) {
    if (value.startsWith('[[') && value.endsWith(']]')) return;
    if (name === 'token-id') name = 'tokenId'

    if (value !== old || !this[name]) this[name] = value
  }

  set sold(value) {
    if (value) {
      const button = this.shadowRoot.querySelector('button')
      button.dataset.action = 'sold'
      button.innerHTML = 'SOLD'
    }

  }

  set price(value) {
    const formatted = ethers.utils.formatUnits(value, 18)
    this.shadowRoot.querySelector('.price').innerHTML = formatted
    this.shadowRoot.querySelector('.price').setAttribute('title', value)
    this.shadowRoot.querySelector('button').dataset.price = value
    this.setAttribute('price', value)
  }

  get price() {
    return this.getAttribute('price')
  }

  set tokenId(value) {
    this.setAttribute('token-id', value)
    this.shadowRoot.querySelector('.tokenId').innerHTML = value
    this.shadowRoot.querySelector('button').dataset.id = value
    this._observer()
  }

  get tokenId() {
    return this.getAttribute('token-id')
  }

  set symbol(value) {
    this.setAttribute('symbol', value)
    this.shadowRoot.querySelector('gpu-img').setAttribute('symbol', value)
    this.shadowRoot.querySelector('.symbol').innerHTML = value
  }

  get symbol() {
    return this.getAttribute('symbol')
  }
  set gpu(value) {
    this.setAttribute('gpu', value)
    this.shadowRoot.querySelector('button').dataset.gpu = value
    this._observer()
  }

  get gpu() {
    return this.getAttribute('gpu')
  }

  set owner(value) {
    this.setAttribute('owner', value)

    if (value === api.signer.address) {
      this.shadowRoot.querySelector('.owner-actions').innerHTML = `
      <flex-row class="owner-actions">
        <!--<custom-svg-icon data-listing="${this.listing}" icon="add-shopping-cart"></custom-svg-icon>
        <custom-svg-icon data-listing="${this.listing}" icon="remove-shopping-cart"></custom-svg-icon>-->
        <custom-svg-icon data-action="changePrice" data-gpu="${this.gpu}" data-id="${this.tokenId}" data-price="${this.price}" icon="attach-money"></custom-svg-icon>
        <flex-one></flex-one>
        <custom-svg-icon data-action="delist" data-gpu="${this.gpu}" data-id="${this.tokenId}" data-price="${this.price}" icon="delete"></custom-svg-icon>
      </flex-row>
      `
    } else {
      this.shadowRoot.querySelector('.owner-actions').innerHTML = ''
    }
  }

  get owner() {
    return this.getAttribute('owner')
  }

  set listing(value) {
    this.setAttribute('listing', value)
  }

  get listing() {
    this.getAttribute('listing')
  }

  _observer() {
    if (!this.gpu || !this.tokenId || this.isOwner === undefined) return

    if (this.gpu && this.tokenId) this.listing = api.listing.createAddress(this.gpu, this.tokenId);
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
      .price {
        padding-right: 4px;
      }
    </style>
    <span class="owner-actions"></span>
    <flex-row>
      <span class="symbol">loading</span>
      <flex-one></flex-one>
      <strong class="tokenId">0</strong>
    </flex-row>
    <gpu-img></gpu-img>
    <flex-one></flex-one>
    <flex-row>
      <span class="price"></span>
      <strong>ART</strong>
      <flex-one></flex-one>
      <button data-action="buy">BUY</button>
    </flex-row>
      `
  }
})

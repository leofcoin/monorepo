import EXCHANGE_ABI from './../abis/exchange'
import GPU_ABI from './../abis/gpu'
import {elevation4dp} from '../styles/elevation'
import './gpu-img'
export default customElements.define('exchange-selector-item', class ExchangeSelectorItem extends HTMLElement {

  static get observedAttributes() {
    return ['address']
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})

    this._ownerActions = ''
    this.asset = 'assets/arteon.svg'
    this.price = '0'
    this.tokenId = '1'

    this.shadowRoot.innerHTML = this.template
  }

  connectedCallback() {

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
        cursor: pointer;
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
    <flex-row>
      <span>${this.symbol ? this.symbol : 'loading'}</span>
    </flex-row>
    <flex-one></flex-one>
    ${this.symbol ? `<gpu-img symbol="${this.symbol}"></gpu-img>` : '<img src="./assets/arteon.svg"></img>'}
    <flex-one></flex-one>
      `
  }
})

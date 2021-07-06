import EXCHANGE_ABI from './../abis/exchange'
import GPU_ABI from './../abis/gpu'
import {elevation4dp} from '../styles/elevation'
import {rotate, basicRotation} from '../styles/shared'


export default customElements.define('gpu-img', class GpuImage extends HTMLElement {

  static get observedAttributes() {
    return ['symbol']
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
  }

  connectedCallback() {
    if (this.hasAttribute('symbol')) this.symbol = this.getAttribute('symbol')

  }

  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value
  }

  set symbol(value) {
    this.setAttribute('symbol', value)
    this._observer()
  }

  get symbol() {
    return this.getAttribute('symbol')
  }

  _observer() {
    if (!this.symbol) return
    this._render()
  }

  async _render(listing, isOwner) {
    this.innerHTML = ''

    this.asset = api.assets.cards[this.symbol]
    this.fanAsset = api.assets.fans[this.symbol]
    const configs = api.assets.configs[this.symbol]
    console.log(configs);
    for (const [x, y, height, width] of configs.fans) {
      const img = document.createElement('img')
      img.setAttribute('slot', 'fan')
      img.src = this.fanAsset
      img.style.height = height
      img.style.width = width
      img.style.top = y
      img.style.left = x
      this.appendChild(img)
    }

    this.shadowRoot.innerHTML = this.template
  }
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        display: flex;
        position: relative;
        max-height: 129px;
        max-width: 274px;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }

      .card {
        // width: 100%;
        height: 100%;
      }


      slot[name="fan"]::slotted(*) {
        position: absolute;
        margin: 0 !important;
        padding: 0 !important;

        -webkit-animation: rotation 2s linear infinite;
        -moz-animation: rotation 2s linear infinite;
        -ms-animation: rotation 2s linear infinite;
        -o-animation: rotation 2s linear infinite;
        animation: rotation 2s linear infinite;
      }
    </style>
    <slot name="fan"></slot>
    <img class="card" src="${this.asset}"></img>

      `
  }
})

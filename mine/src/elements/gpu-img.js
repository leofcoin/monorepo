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
    if (!this.symbol) return;
    this._render()
  }

  async _render(listing, isOwner) {
    this.innerHTML = ''

    this.asset = api.assets.cards[this.symbol]
    this.fanAsset = api.assets.fans[this.symbol]
    this.frontAsset = api.assets.fronts[this.symbol]
    const configs = api.assets.configs[this.symbol]

    for (const [x, y, height, width, id] of configs.fans) {
      const img = document.createElement('img')
      img.setAttribute('slot', 'fan')
      img.src = Boolean(id === undefined) ? this.fanAsset : this.fanAsset.replace('.png', `-${id}.png`)
      img.dataset.id = id;
      img.style.height = height
      img.style.width = width
      img.style.top = y
      img.style.left = x
      this.appendChild(img)
    }
    if (configs.fronts) {
      const [x, y, height, width] = configs.fronts[0]
      const img = document.createElement('img')
      img.setAttribute('slot', 'front')
      img.src = this.frontAsset
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
        width: 100%;
        height: 100%;
      }

      slot[name="fan"]::slotted(*), slot[name="front"]::slotted(*) {
        position: absolute;
        margin: 0 !important;
        padding: 0 !important;
      }

      slot[name="fan"]::slotted(*) {
        -webkit-animation: rotation 2s linear infinite;
        -moz-animation: rotation 2s linear infinite;
        -ms-animation: rotation 2s linear infinite;
        -o-animation: rotation 2s linear infinite;
        animation: rotation 2s linear infinite;
      }

      slot[name="fan"]::slotted([data-id="1"]) {
        -webkit-animation: rotationBack 2s linear infinite;
        -moz-animation: rotationBack 2s linear infinite;
        -ms-animation: rotationBack 2s linear infinite;
        -o-animation: rotationBack 2s linear infinite;
        animation: rotationBack 2s linear infinite;
      }

      @media (max-width: 371px) {
        :host, slot[name="fan"]::slotted(*) {
          height: 0 !important;
          width: 0 !important;
        }
      }
    </style>
    <slot name="fan"></slot>
    <slot name="front"></slot>
    <img class="card" src="${this.asset}"></img>

      `
  }
})

import MINER_ABI from './../abis/miner.js'
import GPU_ABI from './../abis/gpu.js'
import './../array-repeat'
import './exchange-selector-item'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from './../styles/elevation'
import {scrollbar} from './../styles/shared'
export default customElements.define('exchange-selector', class ExchangeSelector extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._select = this._select.bind(this)
  }

  connectedCallback() {
    this._load()

    this.addEventListener('click', this._select)
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  async _load() {
    this._arrayRepeat.items = Object.keys(api.addresses.cards).map(key => {
      return {address: api.addresses.cards[key]}
    })
  }

  _select(event) {
    const target = event.composedPath()[0]
    const route = target.getAttribute('data-route')
    if (route && target.hasAttribute('address')) {
      this._pages.select('pool')
      this.shadowRoot.querySelector('nft-pool')._load(target.getAttribute('address'))
      return
    }
    if (route === 'overview' || route === 'back') this._pages.select('overview')
  }
// hardware:toys
  get template() {
    return `
    <style>
      :host {
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
      }

      section {
        display: flex;
        align-items: center;
      }

      .container {
        padding: 32px 0;
        border-radius: 44px;
        width: 100%;
        height: calc(100% - 96px);
        max-width: 640px;
        background: var(--custom-drawer-background);
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        ${elevation2dp}
        box-shadow: 0 1px 18px 0px var(--accent-color);
      }

      custom-input {
        pointer-events: auto;
        padding: 12px;
        box-sizing: border-box;
        max-width: 640px;
        background: var(--custom-drawer-background);
        --custom-input-color: var(--main-color);
        border-radius: 24px;

        ${elevation2dp}
      }
      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
      custom-pages {
        height: 100%;
      }

      ${scrollbar}
    </style>
    <custom-input placeholder="search by name/address"></custom-input>
    <flex-one></flex-one>

    <span class="container">
      <custom-pages attr-for-selected="data-route">
        <array-repeat data-route="overview">
          <template>
            <style>
              pool-selector-item:nth-of-type(odd) {
                background: #c5c5c5;
              }
              pool-selector-item {
                pointer-events: auto;
                cursor: pointer;
              }
              </style>
            <exchange-selector-item address="[[item.address]]" data-route="[[item.address]]"></exchange-selector-item>
          </template>
        </array-repeat>

        <nft-pool data-route="pool"></nft-pool>
      </custom-pages>
    </span>
    `
  }
})

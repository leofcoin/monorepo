import PLATFORM_ABI from './../../../abis/platform.js'
import MINING_ABI from './../../../abis/mining.js'
import './../array-repeat'
import './pool-selector-item'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from './../styles/elevation'
import {scrollbar} from './../styles/shared'
import { LitElement, html } from 'lit'
import {map} from 'lit/directives/map.js'

export default customElements.define('pool-selector', class PoolSelector extends LitElement {
  static properties = {
    items: {
      type: Array
    }
  }

  constructor() {
    super()
    this._select = this._select.bind(this)
  }

  connectedCallback() {
    super.connectedCallback()
    this._load()
  }


  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  async _load() {
    console.log('load');
    this.contract = api.getContract(api.addresses.platform, PLATFORM_ABI)
    // if (await this._isOwner()) this._ownerSetup()

    const pools = await api.poolNames()

    this.items =  pools.map((pool, i) => {
      return {symbol: pool[1], i: pool[0]}
    })
  }

  _select({detail}) {

    if (detail === 'overview' || detail === 'back') {
      this._pages.select('overview')
      if (detail === 'back') history.back()

      return
    }
    
    this._pages.select('pool')
    this.shadowRoot.querySelector('nft-pool')._load(detail)    
  }


// hardware:toys
  render() {
    return html`
    <style>
      * {
        pointer-events: none;
      }
      :host {
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding: 0 24px;
        padding-top: 24px;
        justify-content: center;
      }

      section {
        display: flex;
        align-items: center;
      }

      .container {
        padding: 32px 0 6px 0;
        border-radius: 44px;
        width: 100%;
        height: 100%;
        max-width: 640px;
        background: var(--custom-drawer-background);
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        max-height: 756px;
        ${elevation2dp}
        box-shadow: 0 1px 18px 0px var(--accent-color);
      }
      custom-selector {
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow-y: auto;
        pointer-events: auto;
      }
      custom-pages {
        height: 100%;
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
      }
      pool-selector-item {
        background: #ee44ee26;
        color: #eee;
      }
      pool-selector-item:nth-of-type(odd) {
        background: transparent;
      }
      pool-selector-item {
        pointer-events: auto !important;
        cursor: pointer;
      }

      ${scrollbar}
    </style>

    <span class="container">
      <custom-pages attr-for-selected="data-route">
        <custom-selector data-route="overview" attr-for-selected="data-route">
          ${map(this.items, item => html`
            <pool-selector-item symbol="${item.symbol}" data-route="${item.i}" id="${item.i}" @click="${() => this._select({ detail: { id:item.i, symbol: item.symbol }})}"></pool-selector-item>
          `)}
        </custom-selector>
        <nft-pool data-route="pool"></nft-pool>
      </custom-pages>
    </span>`
  }
})

import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from '../styles/elevation'
import './../array-repeat'
import './../elements/exchange-selector-item'
import './../elements/exchange-cards'
import { scrollbar } from './../styles/shared'
import PLATFORM_ABI from './../../../abis/platform'

export default customElements.define('exchange-view', class ExchangeView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._select = this._select.bind(this)
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-tabs')
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  connectedCallback() {
    this._init()
    this._selector.addEventListener('selected', this._select)
    // this.shadowRoot.querySelector('[data-event="search"]').addEventListener('input', this._onsearch)
  }

  async _getPools() {
    let pools = await api.pools()
    let promises = []

    for (let i = 0; i < pools.length; i++) {
      promises.push(this.contract.callStatic.token(pools[i]))
    }
    promises = await Promise.all(promises)
    let i = 0

    this.shadowRoot.querySelector('section[data-route="gpus"]').querySelector('array-repeat').items = promises.map((symbol) => {
      i++
      return {symbol, i: pools[i - 1].toString()}
    })
  }

  async _getItems() {
    const items = await this.contract.callStatic.items()
    let promises = []

    for (let i = 0; i < items.length; i++) {
      promises.push(this.contract.callStatic.token(items[i]))
    }
    promises = await Promise.all(promises)
    let i = 0
    this.shadowRoot.querySelector('section[data-route="upgrades"]').querySelector('array-repeat').items = promises.map((symbol) => {
      i++
      return {symbol, i: items[i - 1].toString()}
    })
  }

  async _init() {
    this.contract = api.getContract(api.addresses.platform, PLATFORM_ABI, true)
    this._select({ detail: 'gpus' })
  }
  async _select({detail}) {
    // const target = event.composedPath()[0]
    // const route = target.getAttribute('data-route')

    if (detail === 'overview' || detail === 'back') {
      this._pages.select('overview')
      if (detail === 'back') history.back()

      return
    }

    if (detail) {
      this._pages.select(detail)
      if (detail === 'gpus') {
        this.pools = await this._getPools()
      }
      if (detail === 'upgrades') {
        this.items = await this._getItems()
      }

      return
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
        flex-direction: column;
        --svg-icon-color: #eee;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        padding: 24px 0 48px 0;
        width: 100%;
        height: 100%;
      }

      custom-pages {
        width: 100%;
        heigh: 100%;
      }

      custom-tabs {
        color: var(--main-color);
      }
      custom-tab {
        pointer-events: auto;
        --tab-underline-color: var(--accent-color);
      }

      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;
        pointer-events: auto;
        flex-flow: row wrap;
        max-width: 1400px;
        justify-content: space-evenly;
      }

      section {
        display: flex;
        justify-content: center;
      }
      @media (min-width: 680px){
        :host {
          padding: 24px 12px 48px 12px;
        }
      }
      @media (min-width: 1200px){
        :host {
          padding: 24px 24px 48px 24px;
        }
      }
      ${scrollbar}
    </style>
    <custom-tabs attr-for-selected="data-route">
      <custom-tab data-route="gpus">
        <span>GPUS</span>
      </custom-tab>
      <custom-tab data-route="upgrades">
        <span>UPGRADES</span>
      </custom-tab>
    </custom-tabs>

    <custom-pages attr-for-selected="data-route">
      <section data-route="gpus">
        <array-repeat max="9">
          <style>
            exchange-selector-item {
              margin-bottom: 12px;
            }
          </style>
          <template>
            <exchange-selector-item symbol="[[item.symbol]]" data-route="[[item.i]]" id="[[item.i]]"></exchange-selector-item>
          </template>
        </array-repeat>
      </section>

      <section data-route="upgrades">
        <array-repeat max="9">
          <style>
            exchange-selector-item {
              margin-bottom: 12px;
            }
          </style>
          <template>
            <exchange-selector-item symbol="[[item.symbol]]" data-route="[[item.i]]" id="[[item.i]]"></exchange-selector-item>
          </template>
        </array-repeat>
      </section>
    </custom-pages>
    `
  }
})

import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import EXCHANGE_ABI from './../abis/exchange.js'
import GPU_ABI from './../abis/gpu.js'
import ARTEON_ABI from './../abis/arteon';
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from '../styles/elevation'
import './../array-repeat'
import './../elements/exchange-selector-item'
import './../elements/exchange-cards'
import { scrollbar } from './../styles/shared'

export default customElements.define('exchange-view', class ExchangeView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._select = this._select.bind(this)
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
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

  async _init() {
    this._arrayRepeat.items = Object.keys(api.addresses.cards).map(key => {
      return {address: api.addresses.cards[key]}
    })
  }

  _select({detail}) {
    console.log(detail);

    this.shadowRoot.querySelector('exchange-cards')._load(detail, this._arrayRepeat.shadowRoot.querySelector(`[data-route="${detail}"]`).symbol)
    this._pages.select('cards')
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
        padding: 24px 96px 48px 96px;
        box-sizing: border-box;
        align-items: center;
      }

      custom-selector {
        height: 100%;
        flex-direction: row;
        border-radius: 44px;
        width: 100%;
        max-width: 720px;
        background: var(--custom-drawer-background);
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        box-sizing: border-box;
        padding: 24px;
        ${elevation2dp}
      }

      :host, .container {
        width: 100%;
        height: 100%;
      }

      custom-tab {
        --tab-underline-color: var(--accent-color);
      }

      @media (max-width: 440px) {
        header {
          opacity: 0;
          pointer-events: none;
        }
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

      custom-input {
        --custom-input-color: var(--main-color);
        box-shadow: 0px 1px 3px -1px var(--accent-color);
        margin-bottom: 24px;
      }

      flex-row.owner-buttons {
        position: absolute;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
      }

      button {
        pointer-events: auto;
      }

      .owner-controls {
        opacity: 0;
        pointer-events: none;
      }

      :host([is-owner]) .owner-controls.showable {
        opacity: 1;
        pointer-events: auto;
      }

      custom-pages [data-route] {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      custom-input {
        pointer-events: auto;
      }

      .item {
        display: flex;
      }

      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;
        pointer-events: auto
      }

      custom-pages {
        width: 100%;
      }
      custom-selector array-repeat {
        flex-flow: row wrap;
        justify-content: space-between;
      }
      @media(max-width: 890px) {
        custom-selector {
          max-width: 374px;
        }
        :host {
          padding: 24px;
        }
      }

      @media(min-width: 1150px) {
        custom-selector {
          max-width: 720px;
        }
      }
      @media(min-width: 1480px) {
        custom-selector {
          max-width: 1400px;
        }
      }
      ${scrollbar}
    </style>
    <!--<custom-input data-event="search" placeholder="search by name/address"></custom-input>-->
    <custom-pages attr-for-selected="data-route">
      <section data-route="overview">
        <custom-selector attr-for-selected="data-route">
          <array-repeat max="9">
            <style>
              exchange-selector-item {
                margin-bottom: 12px;
              }
            </style>
            <template>
              <exchange-selector-item address="[[item.address]]" data-route="[[item.address]]"></exchange-selector-item>
            </template>
          </array-repeat>
        </custom-selector>
      </section>

      <exchange-cards data-route="cards"></exchange-cards>
    </custom-pages>


    `
  }
})

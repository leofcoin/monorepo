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

    // this._select = this._select.bind(this)
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
    // this._selector.addEventListener('selected', this._select)
    // this.shadowRoot.querySelector('[data-event="search"]').addEventListener('input', this._onsearch)
  }

  async _init() {
    this._arrayRepeat.items = Object.keys(api.addresses.cards).map(key => {
      return {address: api.addresses.cards[key]}
    })
  }
  // _select({detail}) {
  //   // const target = event.composedPath()[0]
  //   // const route = target.getAttribute('data-route')
  //
  //   if (detail === 'overview' || detail === 'back') {
  //     this._pages.select('overview')
  //     if (detail === 'back') history.back()
  //
  //     return
  //   }
  //
  //   if (detail) {
  //     this.shadowRoot.querySelector('exchange-cards')._load(detail, this._arrayRepeat.shadowRoot.querySelector(`[data-route="${detail}"]`).symbol)
  //     this._pages.select('cards')
  //     return
  //   }
  // }
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
      }

      custom-selector {
        flex-direction: row;
        border-radius: 44px;
        width: 100%;
        max-width: 382px;
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        box-sizing: border-box;
        padding: 24px;
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
        pointer-events: auto;
        flex-flow: row wrap;
        max-width: 1400px;
        justify-content: space-evenly;
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
    
    <arteon-dialog class="owner-controls" data-target="add">
      <h4>Add card</h4>
      <custom-select>
        <array-repeat>
          <template>
            <span class="item" title="[[item.listing]]" data-route="[[item.name]]" data-listing="[[item.listing]]">
              [[item.name]]
            </span>
          </template>
        </array-repeat>
      </custom-select>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <custom-input data-input="tokenIdTo" placeholder="till TokenId"></custom-input>
      <custom-input data-input="price" placeholder="price"></custom-input>
    </arteon-dialog>
    `
  }
})

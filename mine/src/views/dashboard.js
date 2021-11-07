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

export default customElements.define('dashboard-view', class DashboardView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
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
        flex-direction: column;
        --svg-icon-color: #eee;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        padding: 24px 0 48px 0;
      }
      .data-item {
        color: #eee,
      }
      .data-item span, .heading {
        background: #000;
        color: #eee,
      }
    </style>
    <flex-row>
      <flex-column>
        <flex-row class="data-item">
          <span data-target="total-income"></span>
          <strong>ART</strong>
        </flex-row>

        <flex-row class="data-item">
          <span data-target="power-usage"></span>
          <strong>W</strong>
          <button>add power</button>
        </flex-row>

        <flex-row class="data-item">
          <span data-target="oc-duration"></span>
          <strong>day(s)</strong>

          <button>oc</button>
        </flex-row>

        <flex-row class="data-item">
          <span data-target="hashrate"></span>
        </flex-row>
      </flex-column>
      <flex-column>
        <span class="heading">Inventory</span>

        <array-repeat>
          <template>
            <nft-inventory name="[[item.symbol]]" address="[[item.address]]" amount="[[item.amount]]"></nft-inventory>
          </template>
        </array-repeat>
      </flex-column>
    </flex-row>
    `
  }
})

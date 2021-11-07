import PLATFORM_ABI from './../../../abis/platform.js'
import './../array-repeat'
import './arteon-button'
import './gpu-img'
import {rotate, rotateBack} from './../styles/shared'
export default customElements.define('wallet-selector-item', class WalletSelectorItem extends HTMLElement {
  static get observedAttributes() {
    return ['symbol', 'id', 'balance']
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
  }

  connectedCallback() {
    if (!this.address) this.address = this.getAttribute('address')
  }

  attributeChangedCallback(name, old, value) {
    if(value !== old && value || !this[name] && value) this[name] = value
  }

  set symbol(symbol) {
    if (!symbol) return;

    this._symbol = symbol
    this._render();
  }

  set balance(value) {
    if (value === undefined) return;

    this._balance = value.toString()
    this._render();
  }

  get balance() {
    return this._balance
  }

  set id(id) {
    if (id === undefined) return;

    this._id = id
    this._render();
  }

  get id() {
    return this._id
  }

  get symbol() {
    return this._symbol
  }

  async _render() {
    if (this.symbol, this.id, this.balance) {
      let contract = api.getContract(api.addresses.platform, PLATFORM_ABI, true)
      let promises = await Promise.all([
        contract.callStatic.cap(this.id),
        contract.callStatic.totalSupply(this.id)
      ])
      this.cap = promises[0]
      this.supply = promises[1]

      this.shadowRoot.innerHTML = this.template

      if (this.timeout) clearTimeout(this.timeout)

      this.timeout = () => setTimeout(async () => {
        let promises = await Promise.all([
          contract.callStatic.cap(this.id),
          contract.callStatic.totalSupply(this.id)
        ])
        this.cap = promises[0]
        this.supply = promises[1]
        this.timeout()
      }, 10000);

      this.timeout()
    }

  }
// hardware:toys
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        color: var(--main-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        border-bottom: 1px solid #333;
        box-sizing: border-box;
        // padding: 12px 48px 12px 48px;
        padding: 0 24px 24px 24px;
        background: #eee;
        color: #333;
        pointer-events: auto;
      }
      array-repeat {
        pointer-events: auto;
      }
      h4 {
        margin: 0;
        padding: 6px 0 12px 12px;
        box-sizing: border-box;
      }
      img {
        margin-top: 24px;
        width: 320px;
      }

      flex-row {
        width: 100%;
      }

      .explainer {
        padding: 0 6px;
      }

      .logo {
        height: 20px;
        width: 20px;
        margin: 0;
        margin-left: 12px;
        box-sizing: border-box;
      }

      custom-svg-icon {
        margin-left: 12px;
      }
      .info {
        padding-right: 24px;
        box-sizing: border-box;
      }
      flex-row[data-route="overview"] {
        align-items: flex-end;
      }
      @media (max-width: 840px) {
        flex-row[data-route="overview"] {
          flex-direction: column !important;
          align-items: center;
        }
      }
      ${rotateBack}
      ${rotate}
    </style>
      <flex-row data-route="overview">
        <flex-column class="info" style="width: 100%;">
          <h4><strong>${this.symbol}</strong></h4>

          <flex-row>
            <custom-svg-icon icon="memory"></custom-svg-icon>
            <span class="explainer">Supply Cap</span>
            <flex-one></flex-one>
            <span>${this.cap}</span>
          </flex-row>
          <flex-one></flex-one>

          <flex-row>
            <custom-svg-icon icon="memory"></custom-svg-icon>
            <span class="explainer">Total Supply</span>
            <flex-one></flex-one>
            <span>${this.supply}</span>
          </flex-row>

          <flex-one></flex-one>

          <flex-row>
            <custom-svg-icon icon="memory"></custom-svg-icon>
            <span class="explainer">balance</span>
            <flex-one></flex-one>
            <span>${this.balance}</span>
          </flex-row>
          <flex-one></flex-one>

          <!-- <flex-row>
            <custom-svg-icon icon="gift"></custom-svg-icon>
            <span class="explainer">reward</span>
            <flex-one></flex-one>
            <custom-select>
              <array-repeat>
                <template>
                  <span class="item" title="[[item.address]]" data-route="[[item.symbol]]" data-address="[[item.address]]">
                    [[item.symbol]]
                  </span>
                </template>
              </array-repeat>
            </custom-select>
          </flex-row>
          -->
        </flex-column>
        <gpu-img symbol="${this.symbol}" loading="lazy"></gpu-img>
      </flex-row>
      <!-- <custom-svg-icon icon="arrow-drop-down"></custom-svg-icon> -->
    `
  }
})

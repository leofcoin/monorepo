import PLATFORM_ABI from './../../../abis/platform.js'
import './../array-repeat'
import './../elements/wallet-selector-item'
import './../../node_modules/custom-pages/src/custom-pages'
import {elevation2dp} from './../styles/elevation'
import {scrollbar} from './../styles/shared'
import './../elements/wallet-token'

export default customElements.define('wallet-view', class WalletView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._select = this._select.bind(this)

    this._selector.addEventListener('selected', this._select)
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
    this._updateBalances()
  }

  async _updateBalances() {
    const batch = await api.platform.balanceOfAll(api.signer.address)
    this.contract = api.getContract(api.addresses.platform, PLATFORM_ABI)
    // if (await this._isOwner()) this._ownerSetup()

    const tokens = await api.tokens()
    let promises = tokens.map(id => this.contract.callStatic.token(id))

    promises = await Promise.all(promises)

    this._arrayRepeat.items = promises.map((symbol, i) => {
      return {symbol, i: tokens[i].toString(), balance: batch[i].toString()}
    })

    console.log(batch);
  }

  _select({detail}) {
    // const target = event.composedPath()[0]
    // const route = target.getAttribute('data-route')
    if (detail === 'overview' || detail === 'back') {
      this._pages.select('overview')
      if (detail === 'back') history.back()

      return
    }
    // if (detail.includes('send-')) {
    //   detail = detail.split('send-')
    //   console.log(detail);
    //   detail = detail[1].split('-')
    //   console.log(detail);
    //   const id = detail[0];
    //   const el = this.shadowRoot.querySelector('array-repeat').shadowRoot.querySelector(`[data-route="${id}"]`)
    //   const symbol = el.getAttribute('symbol')
    //   const balance = el.getAttribute('balance')
    //   this.shadowRoot.querySelector('wallet-token')._load({symbol, id, balance})
    //   this._pages.select('token')
    //   return
    // }
    if (detail) {
      const id = detail;
      const el = this.shadowRoot.querySelector('array-repeat').shadowRoot.querySelector(`[data-route="${id}"]`)
      const symbol = el.getAttribute('symbol')
      const balance = el.getAttribute('balance')
      this.shadowRoot.querySelector('wallet-token')._load({symbol, id, balance})
      this._pages.select('token')
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
        width: 100%;
        height: calc(100% - 54px);

        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        padding: 0 24px;
        padding-top: 24px;
        justify-content: center;
      }

      .container {
        padding: 32px 0 6px 0;
        border-radius: 44px;
        width: 100%;
        height: 100%;
        max-width: 640px;
        background: var(--custom-drawer-background);
        box-sizing: border-box;
        pointer-events: auto;
        display: flex;
        overflow-y: auto;
        max-height: 756px;
        ${elevation2dp}
        box-shadow: 0 1px 18px 0px var(--accent-color);
      }
      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;

        overflow-y: auto;
        pointer-events: auto;
      }
    </style>
    <span class="container">
      <custom-pages attr-for-selected="data-route">
        <custom-selector data-route="overview" attr-for-selected="data-route">
          <array-repeat data-route="overview">

            <style>
              wallet-selector-item {
                background: #ee44ee26;
                color: #eee;
              }
              wallet-selector-item:nth-of-type(odd) {
                background: transparent;
              }
              wallet-selector-item {
                pointer-events: auto;
                cursor: pointer;
              }
              </style>
            <template>
              <wallet-selector-item symbol="[[item.symbol]]" data-route="[[item.i]]" id="[[item.i]]" balance="[[item.balance]]"></wallet-selector-item>
            </template>
          </array-repeat>
        </custom-selector>

        <wallet-token data-route="token"></wallet-token>
      </custom-pages>
      </span>
    `
  }
})

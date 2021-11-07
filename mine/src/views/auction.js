import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from '../styles/elevation'
import './../array-repeat'
import './../elements/auction-selector-item'
import { scrollbar } from './../styles/shared'
import PLATFORM_ABI from './../../../abis/platform'
import EXCHANGE_ABI from './../../../abis/exchange'
import './../elements/gpu-select'

export default customElements.define('auction-view', class AuctionView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._onselect = this._onselect.bind(this)
    this._onclick = this._onclick.bind(this)
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  get _dialog() {
    return this.shadowRoot.querySelector('arteon-dialog')
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _gpuImg() {
    return this.shadowRoot.querySelector('gpu-img')
  }

  get _gpuID() {
    return this.shadowRoot.querySelector('[data-input="id"]')
  }

  get _arrayList() {
    return this.shadowRoot.querySelector('array-repeat.list')
  }

  get _arraySelect() {
    return this.shadowRoot.querySelector('array-repeat.select')
  }

  connectedCallback() {
    this._init()
    this.shadowRoot.querySelector('button').addEventListener('click', this._onclick)
    this.shadowRoot.querySelector('gpu-select').addEventListener('selected', this._onselect)
    // this.shadowRoot.querySelector('[data-event="search"]').addEventListener('input', this._onsearch)
  }

  async _onclick() {
    const result = await this._dialog.show()
    if (result.action === 'confirm') {
      const symbol = this.shadowRoot.querySelector('gpu-select').selected
      const names = await api.tokenNames()
      const id = names.indexOf(symbol)
      try {
        let tx
        if (!await this.contract.isApprovedForAll(api.signer.address, api.addresses.exchange)) {
          tx = await this.contract.setApprovalForAll(api.addresses.exchange, true)
          await tx.wait()
        }
        tx = await this.exchangeContract.list(id, result.value.tokenId, ethers.utils.parseUnits(result.value.price))
        await tx.wait()
      } catch (e) {
        console.error(e);
      }
    }
  }

  async _init() {

    this.contract = api.getContract(api.addresses.platform, PLATFORM_ABI, true)
    this.exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI, api.signer)
    const pools = await api.pools()
    let promises = []
    let names = []

    for (let i = 0; i < pools.length; i++) {
      promises.push(this.exchangeContract.callStatic.auctionLength(pools[i]))
      names.push(this.contract.callStatic.token(pools[i]))
    }
    promises = await Promise.all(promises)
    names = await Promise.all(names)

    this.names = names
    this.pools = pools

    promises = promises.reduce((prev, id) => {
      if (id.toNumber() !== 0) prev.push(id)
      return prev
    }, [])
    if (promises.length === 0) {
      this.shadowRoot.querySelector('.no-items').setAttribute('show', '')
      return
    }
    console.log(promises);
    let i = 0
    this._arrayList.items = promises.map((symbol) => {
      i++
      return {symbol, i: i - 1}
    })
  }

  async _onselect({detail}) {

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
        border-radius: 24px;
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
      .no-items {
        color: aliceblue;
        display: flex;
        opacity: 0;
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        align-items: center;
        justify-content: center;
      }
      flex-row {
        padding: 12px 0;
        align-items: center;
      }
      [show] {
        opacity: 1;
      }
      h4 {
        margin: 0;
      }
      .center {
        justify-content: center;
      }
      button.auction {
        position: absolute;
        right: 24px;
        bottom: 24px;
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
    <span class="no-items">
      <h4>No auctions found.</h4>
    </span>

    <arteon-dialog class="owner-controls" data-target="add">
      <h4 slot="title">Auction GPU</h4>
      <gpu-select></gpu-select>
      <flex-one></flex-one>
      <custom-input data-input="tokenId" placeholder="TOKEN ID"></custom-input>
      <custom-input data-input="price" placeholder="PRICE"></custom-input>
    </arteon-dialog>
    <array-repeat class="list" max="9">
      <style>
        exchange-selector-item {
          margin-bottom: 12px;
        }
      </style>
      <template>
        <auction-selector-item symbol="[[item.symbol]]" data-route="[[item.i]]" id="[[item.i]]"></auction-selector-item>
      </template>
    </array-repeat>

    <button class="auction">auction</button>
    `
  }
})

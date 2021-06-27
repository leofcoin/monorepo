import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import EXCHANGE_ABI from './../abis/exchange.js'
import GPU_ABI from './../abis/gpu.js'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from '../styles/elevation'
import './../elements/arteon-dialog'
import './../../node_modules/@vandeurenglenn/custom-select/custom-select'
import './../array-repeat'
import './../elements/exchange-item'

export default customElements.define('exchange-view', class ExchangeView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._select = this._select.bind(this)
    this._onclick = this._onclick.bind(this)
    this._onsearch = this._onsearch.bind(this)
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  connectedCallback() {
    this._init()
    this.shadowRoot.querySelector('[data-event="search"]').addEventListener('input', this._onsearch)
  }

  async _onsearch() {
    console.log(this.shadowRoot.querySelector('[data-event="search"]').value.length);
    if (this._timeout) clearTimeout(this._timeout)
    this._timeout = () => setTimeout(async () => {

      const value = this.shadowRoot.querySelector('[data-event="search"]').value
      if (value.length === 0) {
        this._arrayRepeat.items = this.listings
        return
      }
      let items = this._arrayRepeat.shadowRoot.querySelectorAll('exchange-item')
      console.log({items});
      if (!items) return
      const isOwner = await this._isOwner()
      items = [...items].filter(item => item.symbol.toLowerCase().includes(value) || item.listing.includes(value) || item.dataset.index === value)
      items = items.map(item => {
        return { listing: item.listing, index: item.dataset.index, isOwner }
      })
      this._arrayRepeat.items = items
    }, 500);
    this._timeout()
  }

  async _onclick(event) {
    console.log(event);
    console.log(event.target);
    console.log(event.composedPath());
    const target = event.composedPath()[0]
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action')
      switch (action) {
        case 'add':
          this._showDialog(action)
          break;
        case 'buy':
          const _target = this.shadowRoot.querySelector(`[data-target="${action}"]`)
          const listing = await this.contract.lists(target.dataset.listing)
          _target.querySelector('[data-input="address"]').value = listing.gpu
          _target.querySelector('[data-input="tokenId"]').value = listing.tokenId
          _target.querySelector('[data-input="price"]').innerHTML = ethers.utils.formatUnits(listing.price, 18)
          this._showDialog(action)
          break;
      }
      return
    }
  }

  async _showDialog(target) {
    const {action, value} = await this.shadowRoot.querySelector(`[data-target="${target}"]`).show()

    if (action === 'confirm') {
      switch (target) {
        case 'add':
          this._addListing(value)
          break;
        case 'buy':
          this._buyCard(value)
          break;
      }

    }
  }

  async _init() {
    this.addEventListener('click', this._onclick)
    const address = api.addresses.exchange
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, EXCHANGE_ABI, api.signer)
    this.contract = globalThis._contracts[address]
    const _listings = await this.contract.callStatic.listingLength();
    console.log(_listings);
    const listings = []

    for (var i = 0; i < _listings; i++) {
      listings.push(await this.contract.callStatic.listings(i))
      // array[i]
    }
    const isOwner = await this._isOwner()
    this.listings = listings.map((listing, index) => {
      return { listing, index, isOwner }
    })
    this._arrayRepeat.items = this.listings
    this._selector.addEventListener('selected', this._select)

    if (isOwner) this._ownerSetup()
  }

  async _addListing({address, tokenId, price, tokenIdTo}) {
    tokenIdTo = tokenIdTo || tokenId
    console.log({address, tokenId, price});
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, GPU_ABI, api.signer)

    const isApprovedForAll = await globalThis._contracts[address].callStatic.isApprovedForAll(api.signer.address, api.addresses.exchange)
    console.log(isApprovedForAll);
    if (!isApprovedForAll) {
      const approved = await globalThis._contracts[address].setApprovalForAll(api.addresses.exchange, true)
      await approved.wait()
    }
    let nonce = await api.signer.getTransactionCount()
    let promises = [];
    for (let i = Number(tokenId); i <= Number(tokenIdTo); i++) {
      promises.push(this.contract.list(address, i, ethers.utils.parseUnits(price, 18), {nonce: nonce++}))
    }
    promises = await Promise.all(promises)
    promises = promises.map(promise => promise.wait())
    promises = await Promise.all(promises)
  }

  async _buyCard({address, tokenId, price}) {
    const listing = await this.contract.callStatic.getListing(address, tokenId)
    await api.exchange.buy(listing, tokenId)
  }

  async _removeCard({address, tokenId, price}) {
    const contract = api.getContract(address)
    const gpuAddress = await contract.callStatic.arteonGPU()
    await api.exchange.remove(gpuAddress, tokenId)
  }

  async _isOwner() {
    return await this.contract.owner() === api.signer.address
  }

  _select({detail}) {
    this._pool.address = detail
  }

  _ownerSetup() {
    this.setAttribute('is-owner', '')
    const items = this._arrayRepeat.shadowRoot.querySelectorAll('exchange-item')
    for (const item of items) {
      item.setAttribute('is-owner', '')
    }
    const repeat = this.shadowRoot.querySelector('custom-select').querySelector('array-repeat')
    repeat.items = Object.keys(api.addresses.pools).map(key => {
      return {
        name: key,
        address: api.addresses.cards[key]
      }
    })

    const _onGPUSelected = ({detail}) => {
      console.log(detail);
      this.shadowRoot.querySelector('[data-input="address"]').value = api.addresses.cards[detail]
    }
    _onGPUSelected({detail: 'genesis'})
    this.shadowRoot.querySelector('custom-select').selected = 'genesis'
    this.shadowRoot.querySelector('custom-select').addEventListener('selected', _onGPUSelected)
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

    </style>
    <!--<custom-input data-event="search" placeholder="search by name/address"></custom-input>-->
    <custom-pages>
      <section data-route="overview">
        <custom-selector>
          <array-repeat max="12">
            <style>
              exchange-item {
                margin-bottom: 12px;
              }
            </style>
            <template>
              <exchange-item listing="[[item.listing]]" is-owner="[[item.isOwner]]"></exchange-item>
            </template>
          </array-repeat>
        </custom-selector>
      </section>
    </custom-pages>
    <flex-row class="owner-buttons owner-controls showable">
      <button data-action="add">
        <custom-svg-icon icon="add"></custom-svg-icon>
        <flex-one></flex-one>
        <strong>ADD CARD</strong>
      </button>
    </flex-row>

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

    <arteon-dialog class="owner-controls" data-target="buy">
      <h4>buy</h4>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <flex-row>
        <strong>for</strong>
        <flex-one></flex-one>
        <span data-input="price"></span>
        <strong>ART</strong>
      </flex-row>

    </arteon-dialog>
    `
  }
})

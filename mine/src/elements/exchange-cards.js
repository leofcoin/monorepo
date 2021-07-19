import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import EXCHANGE_ABI from './../abis/exchange.js'
import GPU_ABI from './../abis/gpu.js'
import ARTEON_ABI from './../abis/arteon';
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from '../styles/elevation'
import './../elements/arteon-dialog'
import './../../node_modules/@vandeurenglenn/custom-select/custom-select'
import './../array-repeat'
import './../elements/exchange-item'
import { scrollbar } from './../styles/shared'

export default customElements.define('exchange-cards', class ExchangeCards extends HTMLElement {
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
    this._selector.addEventListener('selected', this._select)
    this.addEventListener('click', this._onclick)
    // this.shadowRoot.querySelector('[data-event="search"]').addEventListener('input', this._onsearch)
  }

  async _onsearch() {
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
    const target = event.composedPath()[0]
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action')
      let _target
      let listing
      switch (action) {
        case 'add':
          this._showDialog(action)
          break;
        case 'buy':
          _target = this.shadowRoot.querySelector(`[data-target="${action}"]`)
          console.log(target);
          _target.querySelector('[data-input="address"]').value = target.dataset.gpu
          _target.querySelector('[data-input="tokenId"]').value = target.dataset.id
          const contract = await api.getContract(api.addresses.token, ARTEON_ABI)
          console.log(contract);
          const maxAllowance = await contract.callStatic.allowance(api.signer.address, api.addresses.exchange)
          _target.querySelector('[data-input="allowance"]').value = maxAllowance.lt(target.dataset.price) ? ethers.utils.formatUnits(target.dataset.price, 18) : ethers.utils.formatUnits(maxAllowance, 18)
          _target.querySelector('[data-input="price"]').innerHTML = ethers.utils.formatUnits(target.dataset.price, 18)
          this._showDialog(action)
          break;
        case 'delist':
          _target = this.shadowRoot.querySelector(`[data-target="${action}"]`)
          _target.querySelector('[data-input="address"]').value = target.dataset.gpu
          _target.querySelector('[data-input="tokenId"]').value = target.dataset.id
        this._showDialog(action)
        break;
        case 'changePrice':
        _target = this.shadowRoot.querySelector(`[data-target="${action}"]`)
        _target.querySelector('[data-input="address"]').value = target.dataset.gpu
        _target.querySelector('[data-input="tokenId"]').value = target.dataset.id
        _target.querySelector('[data-input="price"]').value = ethers.utils.formatUnits(target.dataset.price, 18)
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
        case 'delist':
          this._delistCard(value)
          break;
        case 'changePrice':
          this._changePrice(value)
          break;
      }

    }
  }

  async _delistCard({address, tokenId}) {
    let tx = await this.exchangeContract.delist(address, tokenId)
    await tx.wait()
  }

  async _changePrice({address, tokenId, price}) {
    let tx = await this.exchangeContract.setPrice(address, tokenId, ethers.utils.parseUnits(price, 18))
    await tx.wait()
  }

  async _load(address, symbol) {
    this.exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI)
    const length = await this.exchangeContract.callStatic.gpuListingLength(address)

    let promises = []
    for (var i = 0; i < length; i++) {
      promises.push(this.exchangeContract.callStatic.gpuListing(address, i))
    }

    promises = await Promise.all(promises)
    const isOwner = await this._isOwner()
    if (isOwner) this._ownerSetup()
    promises = promises.map(address => this.exchangeContract.lists(address))
    promises = await Promise.all(promises)
    promises = promises.filter(promise => promise.listed === true)

    this.listings = promises.map(({
      owner,
      gpu,
      index,
      price,
      tokenId
    }) => {
      return {
        owner,
        gpu,
        index,
        price: price.toString(),
        tokenId: tokenId.toString(),
        isOwner,
        symbol
      }
    })

    this.shadowRoot.querySelector('array-repeat.cards').items = this.listings

    this.exchangeContract.on('Delist', (gpu, tokenId) => {
      console.log({gpu});
      setTimeout(() => {
        const item = this._arrayRepeat.shadowRoot.querySelector(`exchange-item[listing="${listing}"]`)
        this.listings = this.listings.filter(item => item.listing !== listing ? item : false)
        this._arrayRepeat.shadowRoot.removeChild(item)
      }, 10000);
    })

    this.exchangeContract.on('ListingCreated', (gpu, tokenId, listing, index, price) => {
      if (this._arrayRepeat.shadowRoot.querySelector(`exchange-item[listing="${listing}"]`)) return;
      this.listings.push({listing, index, tokenId, gpu, isOwner})
      const item = document.createElement('exchange-item')
      item.setAttribute('listing', listing)
      item.setAttribute('is-owner', isOwner)
      this._arrayRepeat.shadowRoot.appendChild(item)
    })

    this.exchangeContract.on('Buy', (gpu, tokenId, listing, owner, price) => {
      // if (owner === api.signer.address) this.pushNotification(true)

      const item = this._arrayRepeat.shadowRoot.querySelector(`exchange-item[listing="${listing}"]`)
      console.log(item);
      if (item) {
        item.setAttribute('sold', 'true')
        setTimeout(() => {
          item.style.transform = 'translateY(-110%)';
        }, 9500);
        setTimeout(() => {
          this._arrayRepeat.shadowRoot.removeChild(item)
        }, 10000);
      }
      console.log(gpu, tokenId, listing, price);
    })
  }

  async sort() {
    const isOwner = await this._isOwner()
    const items = this._arrayRepeat.shadowRoot.querySelectorAll('exchange-item')
    let cardSeriesListed = [...items].reduce((set, item) => {
      if (!set[item.symbol]) set[item.symbol] = []

      set[item.symbol].push({listing: item.listing, index: item.dataset.index, tokenId: item.tokenId, isOwner})
      return set
    }, {})

    let sorted = []
    Object.keys(cardSeriesListed).forEach((key, i) => {
      cardSeriesListed[key] = cardSeriesListed[key].sort((a, b) => a.tokenId - b.tokenId)
    });
    for (const set of Object.keys(cardSeriesListed)) {
      sorted = [...sorted, ...cardSeriesListed[set]]
    }

    this._arrayRepeat.items = sorted
  }

  async _addListing({address, tokenId, price, tokenIdTo}) {
    tokenIdTo = tokenIdTo || tokenId
    const listing = api.listing.createAddress(address, tokenId)
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
      promises.push(this.exchangeContract.list(listing, address, i, ethers.utils.parseUnits(price, 18), {nonce: nonce++, gasLimit: 8000000}))
    }
    promises = await Promise.all(promises)
    promises = promises.map(promise => promise.wait())
    promises = await Promise.all(promises)
  }

  async _buyCard({address, tokenId, price, allowance}) {
    await api.exchange.buy(address, tokenId, ethers.utils.parseUnits(allowance))
  }

  async _removeCard({address, tokenId, price}) {
    const contract = api.getContract(address)
    const gpuAddress = await contract.callStatic.arteonGPU()
    await api.exchange.remove(gpuAddress, tokenId)
  }

  async _isOwner() {
    return await this.exchangeContract.owner() === api.signer.address
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
    repeat.items = Object.keys(api.addresses.cards).map(key => {
      return {
        name: key,
        address: api.addresses.cards[key]
      }
    })

    const _onGPUSelected = ({detail}) => {
      console.log(detail);
      this.shadowRoot.querySelector('[data-target="add"]').querySelector('[data-input="address"]').value = api.addresses.cards[detail]
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

      h6, h4 {
        margin: 0;
        padding-left: 12px;
        padding-bottom: 12px;
        box-sizing: border-box;
        text-transform: uppercase;
      }
      h4 {
        padding-bottom: 24px;
      }

      arteon-dialog flex-row.price {
        padding: 0 12px 12px 12px;
        box-sizing: border-box;
      }

      arteon-dialog flex-row.price strong {
        padding-left: 6px;
      }
      ${scrollbar}
    </style>
    <!--<custom-input data-event="search" placeholder="search by name/address"></custom-input>-->
    <custom-pages>
      <section data-route="overview">
        <custom-selector>
          <array-repeat max="9" class="cards">
            <style>
              exchange-item {
                margin-bottom: 12px;
              }
            </style>
            <template>
              <exchange-item price="[[item.price]]" token-id="[[item.tokenId]]" symbol="[[item.symbol]]" gpu="[[item.gpu]]" owner="[[item.owner]]" is-owner="[[item.isOwner]]"></exchange-item>
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

    <arteon-dialog class="owner-controls" data-target="delist">
      <h4 slot="title">Delist card</h4>
      <h6>gpu</h6>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <h6>token id</h6>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <flex-row style="width: 100%;">
        <flex-one></flex-one>
        <strong>
          Are you sure you want to delist?
        </strong>
        <flex-one></flex-one>
      </flex-row>

    </arteon-dialog>

    <arteon-dialog class="owner-controls" data-target="changePrice">
      <h4 slot="title">change price</h4>
      <h6>gpu</h6>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <h6>token id</h6>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <h6>price</h6>
      <custom-input data-input="price" placeholder="price"></custom-input>
    </arteon-dialog>

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
      <h4 slot="title">buy</h4>
      <h6>GPU</h6>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <h6>TOKEN ID</h6>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <h6>ALLOWANCE</h6>
      <custom-input data-input="allowance" placeholder="allowance"></custom-input>

      <h6>FOR</h6>
      <flex-row class="price">
        <span data-input="price"></span>
        <strong>ART</strong>
      </flex-row>

    </arteon-dialog>
    `
  }
})

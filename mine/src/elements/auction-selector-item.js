import EXCHANGE_ABI from './../../../abis/exchange'
import PLATFORM_ABI from './../../../abis/platform'
import ART_ONLINE_ABI from './../../../abis/artonline'
import {elevation4dp} from '../styles/elevation'
import {rotate, rotateBack} from '../styles/shared'
import './gpu-img'
export default customElements.define('auction-selector-item', class AuctionSelectorItem extends HTMLElement {

  // static get observedAttributes() {
  //   return ['symbol', 'id']
  // }

  get _buybutton() {
    return this.shadowRoot.querySelector('button')
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})

    this._ownerActions = ''
    this.asset = 'assets/arteon.svg'
    this.price = '0'
    this.shadowRoot.innerHTML = this.template

    this._onbuy = this._onbuy.bind(this)
    this._onevent = this._onevent.bind(this)
  }

  connectedCallback() {
    this._render(this.symbol, this.id)
  }
  // attributeChangedCallback(name, old, value) {
  //   if(value !== old || !this[name]) this[name] = value
  // }

  set id(value) {
    this.setAttribute('id', value)
  }

  get id() {
    return this.getAttribute('id')
  }

  set symbol(value) {
    this.setAttribute('symbol', value)
  }

  get symbol() {
    return this.getAttribute('symbol')
  }

  async _render(symbol, id) {
    const exchangeContract = new ethers.Contract(api.addresses.exchange, EXCHANGE_ABI, api.signer)
    const platformContract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, api.signer)
    const listing = await exchangeContract.lists(id)
    const supplyCap = await platformContract.cap(id)
    const totalSupply = await platformContract.totalSupply(id)
    this.stock = await api.calculateStock(id)
    this.price = ethers.utils.formatUnits(listing.price, 18)
    if (listing.listed === 0) {
      // show last price
      this.shadowRoot.innerHTML = this.template
      this._buybutton.innerHTML = 'OUT OF STOCK'
      this._buybutton.setAttribute('disabled', '')
    } else {
      this.shadowRoot.innerHTML = this.template
      if (this.stock === '0') {
        this._buybutton.innerHTML = 'OUT OF STOCK'
        this._buybutton.setAttribute('disabled', '')
      } else {
        this._buybutton.addEventListener('click', this._onbuy)
      }

    }
    exchangeContract.on('Sold', this._onevent)
    exchangeContract.on('List', this._onevent)
  }

  async _onevent(id, tokenId, price) {
    if (id.toString() !== this.id) return;
    this.stock = await api.calculateStock(id)
    this._buybutton.removeEventListener('click', this._onbuy)
    this.shadowRoot.innerHTML = this.template
    this._buybutton.addEventListener('click', this._onbuy)
  }

  async _onbuy() {
    const id = this.id
    const contract = api.getContract(api.addresses.artonline, ART_ONLINE_ABI, api.signer)
    const exchangeContract = api.getContract(api.addresses.exchange, EXCHANGE_ABI, api.signer)
    const platformContract = api.getContract(api.addresses.platform, PLATFORM_ABI, api.signer)
    const listing = await exchangeContract.lists(id)
    if (listing.listed === 0) return;

    let allowance = await contract.callStatic.allowance(api.signer.address, api.addresses.platform)
    let approved;
    if (allowance.isZero()) approved = await contract.approve(api.addresses.platform, listing.price)
    else if (allowance.lt(listing.price)) approved = await contract.increaseAllowance(api.addresses.platform, listing.price.sub(allowance))

    if (approved) await approved.wait()

    try {
      // tokenid = 0 for mint buys, when auctioned pass trough a tokenId
      await exchangeContract.buy(id, ethers.BigNumber.from(0))
    } catch (e) {
      console.warn(`id: ${id} buy failed`);
      const cap = await platformContract.callStatic.cap(id)
      for (let i = 1; i <= cap; i++) {
        console.log(i);
        const owner = await platformContract.callStatic.ownerOf(id, ethers.BigNumber.from(i))
        if (owner === '0xF52D485Eceba4049e92b66df0Ce60fE19589a0C1') {
          console.log({id, i});
          try {
            let tx = await exchangeContract.buy(id, ethers.BigNumber.from(i))
            await tx.wait()
          } catch (e) {
            console.warn(`Failed buying ${i}`);
          }
          return
        }

      }

    }
  }

  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        position: relative;
        display: flex;

        flex-direction: column;
        max-width: 320px;
        max-height: 274px;
        min-height: 274px;
        height: 100%;
        width: 100%;
        align-items: center;
        padding: 12px 0 20px 0;
        color: var(--main-color);
      }

      .container {
        display: flex;
        flex-direction: column;
        width: calc(100% - 6px);
        border-radius: 24px;
        max-height: 274px;
        min-height: 274px;
        height: 100%;
        border: 1px solid #eee;
        align-items: center;
        box-sizing: border-box;
        padding: 12px 0;
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
        height: 40px;
        min-width: 86px;
        pointer-events: auto;
        cursor: pointer;
      }

      img {
        max-height: 154px;
        max-width: 274px;
        width: 100%;
        height: 100%;
      }

      flex-row {
        align-items: center;
      }

      :host([sold="true"]) {
        opacity: 0.48;
        pointer-events: none;
        transition: opacity 120ms, transform 120ms;
      }

      custom-svg-icon {
        pointer-events: auto;
        cursor: pointer;
      }

      button {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        background: var(--main-background-color);
      }
      [disabled] {
        pointer-events: none;
        cursor: default;
        opacity: 0.78;
      }
      ${rotate}
      ${rotateBack}
    </style>
    <span class="container">
      ${this.symbol ? `<gpu-img symbol="${this.symbol}"></gpu-img>` : '<img src="./assets/arteon.svg"></img>'}
      <flex-one></flex-one>
      <flex-row>
        <span>${this.symbol ? this.symbol : 'loading'}</span>
      </flex-row>
      <flex-row>
        <span>${this.price ? this.price : 'loading'}</span>
        <strong style="padding-left: 6px">ART</strong>
      </flex-row>
      <flex-row>
        <span>${this.stock ? this.stock : 'loading'}</span>
        <strong style="padding-left: 6px">in stock  </strong>
      </flex-row>
      <flex-two></flex-two>

    </span>

    <button>BUY</button>
      `
  }
})

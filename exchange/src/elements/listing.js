import LISTING_ERC1155_ABI from './../../../build/contracts/ArtOnlineListingERC1155.json'
import IERC1155MetadataURI from './../../../build/contracts/IERC1155MetadataURI.json'
import currencyByAddress from './../currencies/by-address'
import './asset-player'
export default customElements.define('listing-element', class Listinglement extends BaseClass {
  static get observedAttributes() {
    return ['address']
  }

  set address(value) {
    this._address = value
    this._parse()
  }

  get address() {
    return this._address
  }

  attributeChangedCallback(name, old, value) {
    this[name] = value
  }
  constructor() {
    super()
  }

  async _parse() {
    let response = await fetch(`https://api.artonline.site/listing/info?address=${this.address}`)
    response = await response.json()
    this.listed = response.listed
    this.price = response.price
    this.id = response.id
    this._currency = response.currency
    if (this._currency === api.addresses.artonline) this.currency = 'ART'
    else this.currency = currencyByAddress[this._currency]
    this.tokenId = response.tokenId

    this.shadowRoot.innerHTML = this.template
    this.contractAddress = response.contractAddress
    this.shadowRoot.innerHTML = this.template
    if (response.json) {
      this.img = response.json.image ? response.json.image : response.json.animation
      this.symbol = response.json.symbol
      this.description = response.json.description
    }

    this.shadowRoot.innerHTML = this.template
    if (this.img) this.sqs('asset-player').setAttribute('src', this.img)
  }

  get template() {
    return html`
<style>
  * {
    pointer-events: none;
  }
  :host {
    display: flex;
    flex-direction: column;
    height: 340px;
    width: 234px;
    overflow: hidden;
    box-sizing: border-box;
    padding: 12px;
    /* border: 1px solid #888; */
    border-radius: 24px;
    font-size: 16px;
    box-shadow: 0 1px 18px 0px var(--accent-color);
    color: var(--main-color);
  }

  .symbol {
    letter-spacing: 0.1px;
    font-weight: 600;
    font-size: 14px;
    padding: 8px 0;
  }

  .description {
    padding-bottom: 12px;
    font-size: 14px;
  }

  button {
    background: var(--accent-color);
    color: #fff;
    border-radius: 12px;
    height: 40px;
    border: none;
    width: 96px;
    box-sizing: border-box;
    padding: 12px;
    cursor: pointer;
    pointer-events: auto;
  }
  flex-column {
    height: 100%;
  }

  .price {
    font-size: 14px;
  }

  button[listed="false"] {
    pointer-events: none;
    background: #555;
  }
</style>
<asset-player></asset-player>
<flex-column>
  <flex-row class="symbol">
    ${this.symbol ? `<span>${this.symbol}</span><flex-one></flex-one><span>#</span><span>${this.tokenId}</span>` : '<busy-animation></busy-animation>'}
  </flex-row>
  <span class="description">${this.description ? this.description : '<busy-animation></busy-animation>'}</span>

  <flex-one></flex-one>
  ${this.price ? `<flex-row>
    <button data-action="buy"
      data-id="${this.id}"
      data-token="${this.tokenId}"
      data-contract="${this.contractAddress}"
      data-listing="${this.address}"
      data-price="${this.price}"
      data-currency="${this._currency}"
      listed="${this.listed}">
      ${this.listed ? 'buy' : 'sold'}
    </button>
    <flex-one></flex-one>
    <flex-column class="price">
      <strong>price</strong>
      <flex-row>
        <span>${this.price}</span><span>${this.currency}</span>
      </flex-row>
    </flex-column>

  </flex-row>` : '<busy-animation></busy-animation>'}

</flex-column>
    `
  }
})

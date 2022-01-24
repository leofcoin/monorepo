import './../elements/asset-player'
import currencyByAddress from './../currencies/by-address'

export default customElements.define('listing-view', class ListingView extends BaseClass {
  constructor() {
    super()
  }

  connectedCallback() {

  }
  async parse({address}) {
    let listing = document.querySelector('exchange-shell').sqs(`[address="${address}"]`)
    console.log(listing);
    if (!listing) {
      const response = await fetch(`https://api.artonline.site/listing/info?address=${address}`)
      listing = await response.json()
      listing = {...listing, ...listing.json}
      listing.image = listing.image ? listing.image : listing.animation
    }
    this.id = listing.id
    this.tokenId = listing.tokenId
    this.price = listing.price
    this.description = listing.description
    this.contractAddress = listing.contractAddress
    this._currency = listing.currency
    this.currency = currencyByAddress[listing.currency]
    this.listed = listing.listed
    this.listing = listing.listing
    this.image = listing.image
    this.symbol = listing.symbol || listing.name
    this.shadowRoot.innerHTML = this.template
    this.sqs('asset-player').setAttribute('src', listing.image)
  }

  get template() {
    return html`
<style>
  :host {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .container {
    max-height: 340px;
    max-width: 234px;
    width: 100%;
    height: 100%;

    overflow: hidden;
    box-sizing: border-box;
    padding: 12px;
    /* border: 1px solid #888; */
    border-radius: 24px;
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

<flex-column class="container">
  <asset-player src="${this.image}"></asset-player>
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
</flex-column>
    `
  }
})

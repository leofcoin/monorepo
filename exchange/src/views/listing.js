export default customElements.define('listing-view', class ListingView extends BaseClass {
  constructor() {
    super()
  }

  async parse({address}) {
    let listing = document.querySelector('exchange-shell').sqs(`[address=${address}]`)
    if (!listing) {
      response = await fetch(`https://api.artonline.site/listing/info?address=${address}`)
      liting = await response.json()
    }
    this.id = id
    this.tokenId = tokenId
    this.price = price
    this.description = description
    this.contractAddress = contractAddress
    this.currency = currency
    this.listed = listed
    this.listing = listing
    this.image = image
    this.shadowRoot.innerHTML = this.template
    this.sqs('asset-player').setAttribute('src', image)
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

  @media (min-width: 960px) {
    .container {
      max-width: 720px;
      flex-direction: row;
    }
  }
</style>

<flex-column class="container">
  <asset-player></asset-player>
  <flex-column class="container">
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

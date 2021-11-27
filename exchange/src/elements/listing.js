import LISTING_ERC1155_ABI from './../../../build/contracts/ArtOnlineListingERC1155.json'
import IERC1155MetadataURI from './../../../build/contracts/IERC1155MetadataURI.json'
import currencyByAddress from './../currencies/by-address'
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
    const contract = new ethers.Contract(this.address, LISTING_ERC1155_ABI.abi, api.provider)
    this.price = ethers.utils.formatUnits(await contract.price(), 18)
    this.id = await contract.id()
    this._currency = await contract.currency()
    if (this._currency === api.addresses.artonline) this.currency = 'ART'
    else this.currency = currencyByAddress[this._currency]
    this.tokenId = await contract.tokenId()
    this.shadowRoot.innerHTML = this.template
    this.contractAddress = await contract.contractAddress()
    const ERC1155Contract = new ethers.Contract(this.contractAddress, IERC1155MetadataURI.abi, api.provider)
    let uri = await ERC1155Contract.uri(this.id)
    uri = uri.replace(`{id}`, this.id)
    let response = await fetch(uri)
    response = await response.json()
    console.log(response);
    this.shadowRoot.innerHTML = this.template

    const img = response.animation ? response.animation : response.image
    if (img) this.sqs('img').src = img
    this.symbol = response.symbol
    this.description = response.description
    this.shadowRoot.innerHTML = this.template
  }

  get template() {
    return html`
<style>
  * {
    font-size: 16px;
  }
  :host {
    display: flex;
    flex-direction: column;
    height: 340px;
    width: 300px;
    overflow: hidden;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #888;
    border-radius: 24px;
  }

  .symbol {
    letter-spacing: 0.1px;
    font-weight: 600;
    font-size: 14px;
    padding-bottom: 8px;
  }

  .description {
    padding-bottom: 12px;
    font-size: 14px;
  }

  button {
    background: var(--accent-color);
    color: #fff;
    border-radius: 24px;
    border: none;
    width: 128px;
    box-sizing: border-box;
    padding: 12px;
    cursor: pointer;
    pointer-events: auto;
  }

  img {
    height: 100%;
    max-height: 150px;
    width: 100%;
    border-radius: 24px;
  }
  flex-column {
    height: 100%;
  }
</style>
<img></img>
<flex-column>
  <flex-row class="symbol">
    ${this.symbol ? `<span>${this.symbol}</span><flex-one></flex-one><span>#</span><span>${this.tokenId}</span>` : '<busy-animation></busy-animation>'}
  </flex-row>
  <span class="description">${this.description ? this.description : '<busy-animation></busy-animation>'}</span>

  <flex-one></flex-one>
  ${this.price ? `<flex-row>
    <button>
      buy
    </button>
    <flex-one></flex-one>
    <flex-column>
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

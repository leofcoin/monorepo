import './../array-repeat'
import './../elements/fab'
import './../elements/dialog'
import './../elements/listing'
import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import PLATFORM_ABI from './../../../abis/platform'
import LISTING_ERC1155_ABI from './../../../build/contracts/ArtOnlineListingERC1155.json'
import LISTING_ERC721_ABI from './../../../build/contracts/ArtOnlineListing.json'

export default customElements.define('list-view', class ListView extends BaseClass {
  constructor() {
    super()
    this._onClick = this._onClick.bind(this)
    this._onSelected = this._onSelected.bind(this)
  }

  connectedCallback() {
    (async () => {
      await isApiReady()
      this.shadowRoot.addEventListener('click', this._onClick)
      this.sqs('custom-tabs').addEventListener('selected', this._onSelected)
    })()
  }

  _getCurrency(currency) {
    return currency === '0x0' ? '0x0000000000000000000000000000000000000000' : currency
  }

  async __list(value, ABI) {
    const contract = new ethers.Contract(value.address, ABI, api.connection.provider.getSigner())
    await this._approve(value.address)
    busy.show('Listing')
    const tx = await api.contract.createListing(
      value.address,
      this._getCurrency(value.currency),
      ethers.utils.parseUnits(value.price, 18),
      value.tokenId,
      value.id,
    )
    await tx.wait()
    busy.done()
    location.href = '#!/market'
  }

  async _approve(address) {
    const contract = new ethers.Contract(address, PLATFORM_ABI, api.connection.provider.getSigner())
    const approved = await contract.callStatic.isApprovedForAll(api.connection.accounts[0], api.addresses.exchangeFactory)
    console.log(approved);
    if (!approved) {
      busy.show('Approving')
      try {
        tx = await contract.setApprovalForAll(api.addresses.exchangeFactory, true)
        await tx.wait()
        busy.done()
      } catch (e) {
        busy.hide()
      }
    }
  }


  async _list() {
    if (!api.connection) {
      await api.connectWallet()
    }
    const selected = this.sqs('custom-tabs').selected
    const inputs = this.sqs(`flex-column[data-route="${selected}"]`).querySelectorAll('[data-input]')
    const value = {}
    for (const input of inputs) {
      value[input.getAttribute('data-input')] = input.value
    }

    selected === 'ERC721' ?
      this.__list(value, LISTING_ERC721_ABI.abi) :
      this.__list(value, LISTING_ERC1155_ABI.abi)
  }

  async _onClick(event) {
    const target = event.composedPath()[0]
    if (target.hasAttribute('data-close')) location.href = '#!/market'
    if (target.hasAttribute('data-confirm')) return this._list()
  }
  _onSelected(event) {
    this.sqs('custom-pages').select(event.detail)
  }

  get template() {
    return html`
<style>

  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 12px;
    align-items: center;
    justify-content: center;
  }
  .custom-selected {
    border-color: var(--accent-color);
  }

  .container {
    display: flex;
    flex-direction: column;
    padding-top: 12px;
    height: 100%;
    box-sizing: border-box;
  }

  .hero {
    display: flex;
    flex-direction: column;
    width: 320px;
    max-height: 480px;
    height: 100%;
    padding: 12px 24px;
    color: var(--main-color);
    background: var(--main-background-color);
    box-shadow: 0 1px 18px 0px var(--accent-color);
    border-radius: 24px;
  }

  custom-input {
    border-radius: 12px;
    margin: 12px 0;
  }

  flex-column {
    padding: 0 12px;
    box-sizing: border-box;
  }

  flex-wrap-around {
    width: 100%;
  }

  fab-element {
    pointer-events: auto;
  }

  custom-tab, custom-svg-icon {
    pointer-events: auto;
    cursor: pointer;
  }
</style>
<span class="hero">
  <strong slot="title">List</strong>
  <custom-tabs attr-for-selected="data-route">
    <custom-tab data-route="ERC721">
      <span>ERC721</span>
    </custom-tab>
    <custom-tab data-route="ERC1155">
      <span>ERC1155</span>
    </custom-tab>
  </custom-tabs>
  <span class="container">
  <custom-pages attr-for-selected="data-route">
    <flex-column data-route="ERC721">
      <custom-input data-input="address" placeholder="address"></custom-input>
      <custom-input data-input="id" placeholder="id"></custom-input>
      <custom-input data-input="price" placeholder="price"></custom-input>
      <custom-input data-input="currency" placeholder="currency (0x0 for BNB or any address)"></custom-input>
    </flex-column>

    <flex-column data-route="ERC1155">
      <custom-input data-input="address" placeholder="address"></custom-input>
      <custom-input data-input="tokenId" placeholder="tokenId"></custom-input>
      <custom-input data-input="id" placeholder="id"></custom-input>
      <custom-input data-input="price" placeholder="price"></custom-input>
      <custom-input data-input="currency" placeholder="currency (0x0 for BNB or any address)"></custom-input>
    </flex-column>
  </custom-pages>
  </span>
  <flex-one></flex-one>
  <flex-row>
    <custom-svg-icon icon="clear" data-close></custom-svg-icon>
    <flex-one></flex-one>
    <custom-svg-icon icon="done" data-confirm></custom-svg-icon>
  </flex-row>
</span>

    `
  }
})

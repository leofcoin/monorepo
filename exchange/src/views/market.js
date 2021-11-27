import './../array-repeat'
import './../elements/fab'
import './../elements/dialog'
import './../elements/listing'
import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import PLATFORM_ABI from './../../../abis/platform'
import LISTING_ERC1155_ABI from './../../../build/contracts/ArtOnlineListingERC1155.json'

export default customElements.define('market-view', class MarketView extends BaseClass {
  constructor() {
    super()
    this._onClick = this._onClick.bind(this)
    this._onSelected = this._onSelected.bind(this)
  }

  connectedCallback() {
    (async () => {
      await isApiReady()
      this.shadowRoot.addEventListener('click', this._onClick)
      const listingsLength = await api.contract.listingERC1155Length()
      const listings = []
      for (let i = 0; i < listingsLength; i++) {
        const address = await api.contract.callStatic.listingsERC1155(i)
        listings.push({address})
      }

      this.sqs('array-repeat').items = listings
    })()
  }

  async _onClick(event) {
    const target = event.composedPath()[0]
    if (target.dataset.event === 'list') {
      location.href = '#!/list'
    }
  }
  _onSelected(event) {
    this.sqs('custom-pages').select(event.detail)
  }

  get template() {
    return html`
<style>

  :host {
    display: flex;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 12px;
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
</style>
<flex-wrap-around>
  <array-repeat>
    <template>
      <listing-element address="[[item.address]]"></listing-element>
    </template>
  </array-repeat>
</flex-wrap-around>

<fab-element data-event="list"></fab-element>

    `
  }
})

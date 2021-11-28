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
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action')

      if (action === 'buy') {
        const address = target.getAttribute('data-contract')
        const id = target.getAttribute('data-id')
        const token = target.getAttribute('data-token')
        const price = target.getAttribute('data-price')
        const currency = target.getAttribute('data-currency')

        try {
          let tx
          if (currency === '0x0000000000000000000000000000000000000000') {
            busy.show('Buying')
            tx = await api.contract.buy(address, id, token, {value: ethers.utils.parseUnits(price)});
          } else {
            const approved = await api.isApproved(currency, amount)
            if (!approved) {
              busy.show('Approving')
              await api.approve(currency, amount)
            }
            busy.show('Buying')
            tx = await api.contract.buy(address, id, token);
          }

          await tx.wait()
          busy.done()
        } catch (e) {
          console.log(e);
          alert(e.data.message)
          busy.hide()
        }
      }
    }
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

  fab-element {
    pointer-events: auto;
    background-image: linear-gradient(to right, #ff00b8 0%, rgb(162 93 199) 50%);
    background-size: 200%;
    color: #fff;
    --svg-icon-color: #fff;
    border-color: #fff;
    /* border: none; */
    /* box-shadow: 0 1px 18px 0px var(--accent-color); */
  }

  array-repeat {
    display: flex;
    width: 100%;
    height: 100%;
    flex-flow: row wrap;
    align-items: center;
    justify-content: space-evenly;
    pointer-events: auto;
    box-sizing: border-box;
    padding: 12px;
  }
</style>
  <array-repeat>
    <template>
      <style>
        listing-element {
          margin-bottom: 12px;
        }
      </style>
      <listing-element address="[[item.address]]"></listing-element>
    </template>
  </array-repeat>

<fab-element data-event="list"></fab-element>

    `
  }
})

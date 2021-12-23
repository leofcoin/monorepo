import './../array-repeat'
import './../elements/fab'
import './../elements/dialog'
import './../elements/listing'
import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import PLATFORM_ABI from './../../../abis/platform'
import LISTING_ERC1155_ABI from './../../../build/contracts/ArtOnlineListingERC1155.json'

globalThis.showOnlyListed = true

export default customElements.define('market-view', class MarketView extends BaseClass {
  constructor() {
    super()
    this._onClick = this._onClick.bind(this)
    this._onSelected = this._onSelected.bind(this)
    this._onSold = this._onSold.bind(this)
    this._onList = this._onList.bind(this)
  }

  connectedCallback() {
    (async () => {
      await isApiReady()
      this.shadowRoot.addEventListener('click', this._onClick)
      let response = await fetch('https://api.artonline.site/countdown')
      const countdown = await response.text()
      let listings
      if (countdown !== '0') {
        console.log(countdown);
        await showCountDown(countdown)
        location.href = '#!/market'
        response = await fetch('https://api.artonline.site/listings/ERC1155')
        listings = await response.json();
      } else {
      response = await fetch('https://api.artonline.site/listings/ERC1155')

        listings = await response.json();
      }
      this.listings = listings
      // if (globalThis.showOnlyListed === true) {
      // listings = listings.filter(listing => listing.listed ? listing : false)
      // }
      this.sqs('array-repeat').items = listings

      api.contract.on('Sold', this._onSold)
      api.contract.on('List', this._onList)

      document.addEventListener('custom-search', async ({detail}) => {
        if (detail === '') {
          const response = await fetch('https://api.artonline.site/listings/ERC1155')
          this.sqs('array-repeat').items = await response.json()
          return
        }
        const listingsEls = Array.from(this.sqs('array-repeat').shadowRoot.querySelectorAll('listing-element'))
        if (listingsEls.length > 0) {
          this.sqs('array-repeat').shadowRoot.innerHTML = ''
          this.sqs('array-repeat').items = listingsEls.filter(listing => {
            if (!listing.tokenId) return false;

            if (listing.address.includes(detail) ||
                listing.id.includes(detail) ||
                listing.currency.includes(detail) ||
                listing._currency.includes(detail) ||
                listing.tokenId.includes(detail) ||
                listing.contractAddress.includes(detail) ||
                listing.price.includes(detail) ||
                listing.symbol.includes(detail)
              ) return true;

              console.log(false);
              return false
          }).map(listing => { return {address: listing.address}})
        } else {
          const response = await fetch('https://api.artonline.site/listings/ERC1155')
          this.sqs('array-repeat').items = await response.json()
        }
      })
    })()
  }

  async _onevent(id, tokenId, price) {
    if (id.toString() !== this.id) return;
    this.stock = await api.calculateStock(id)
    this._buybutton.removeEventListener('click', this._onbuy)
    this.shadowRoot.innerHTML = this.template
    this._buybutton.addEventListener('click', this._onbuy)
  }

  async _onList(listing) {
    const el = this.sqs('array-repeat').shadowRoot.querySelector(`listing-element`)
    this.listings.push({address: listing})
    this.sqs('array-repeat').items = this.listings
  }

  async _onSold(id, tokenId, price) {
    console.log(id, tokenId);
    const els = Array.from(this.sqs('array-repeat').shadowRoot.querySelectorAll(`listing-element`))
    for (const el of els) {
      if (el.id === id) el.setAttribute('address', el.getAttribute('address'))
    }
  }

  async _onClick(event) {
    const target = event.composedPath()[0]
    console.log(target);
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action')
      if (action === 'show') {
        if (!customElements.get(`listing-view`)) await import(`./listing.js`)
        location.href = `#!/listing?address=${target.address}`
        return
      }
      if (action === 'buy') {
        if (!api.connection) {
          await api.connectWallet()
        }
        const address = target.getAttribute('data-contract')
        const id = target.getAttribute('data-id')
        const token = target.getAttribute('data-token')
        const price = target.getAttribute('data-price')
        const currency = target.getAttribute('data-currency')
        try {
          let tx
          if (currency === '0x0000000000000000000000000000000000000000') {
            busy.show('Buying')
            tx = await api.contract.buy(address, id, token, { value: ethers.utils.parseUnits(price) });
          } else {
            const approved = await api.isApproved(currency, price)
            if (!approved) {
              busy.show('Approving')
              await api.approve(currency, price)
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
    pointer-events: auto;
    display: flex;
    width: 100%;
    height: 100%;
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
    flex-direction: column;
    width: 100%;
    height: 100%;
    pointer-events: auto;
    box-sizing: border-box;
    padding: 12px;
    max-width: 1426px;
  }

  [slot="content"] {

      display: flex;
      width: 100%;
      height: 100%;
      flex-flow: row wrap;
      align-items: center;
      justify-content: space-evenly;
      pointer-events: auto;
      box-sizing: border-box;
      padding: 12px;
      max-width: 1426px;
  }

    listing-element {
      cursor: pointer;
      pointer-events: auto;
      margin-bottom: 12px;
    }
</style>
  <array-repeat max="15">
    <template>
      <listing-element data-action="show" address="[[item.address]]"></listing-element>
    </template>

  </array-repeat>

<fab-element data-event="list"></fab-element>

    `
  }
})

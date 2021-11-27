import './../array-repeat'
import './../elements/fab'
import './../elements/dialog'
import './../elements/listing'
import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import PLATFORM_ABI from './../../../abis/platform'
import LISTING_ERC1155_ABI from './../../../build/contracts/ArtOnlineListingERC1155.json'

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

  async _onClick(event) {
    const target = event.composedPath()[0]
    if (target.dataset.event === 'list') {
      if (!api.connection) {
        await api.connectWallet()
      }
      let tx;

      if (this.sqs('custom-tabs').selected === 'ERC721') {
        const contract = new ethers.Contract(result.value.address, ERC721_ABI, api.connection.provider.getSigner())
        await contract.approve(result.value.address, result.value.id)
        tx = await api.contract.listERC721(
          result.value.address,
          result.value.id,
          result.value.price,
          result.value.currency == '0x0' ? '0x0000000000000000000000000000000000000000' : result.value.currency
        )
      } else {
        const contract = new ethers.Contract(result.value.ERC1155_address, PLATFORM_ABI, api.connection.provider.getSigner())
        const approved = await contract.callStatic.isApprovedForAll(api.connection.accounts[0], api.addresses.exchangeFactory)
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

        busy.show('Listing')

        try {
          tx = await api.contract.listERC1155(
            result.value.ERC1155_address,
            result.value.ERC1155_tokenId,
            result.value.ERC1155_id,
            ethers.utils.parseUnits(result.value.ERC1155_price),
            result.value.ERC1155_currency == '0x0' ? '0x0000000000000000000000000000000000000000' : result.value.ERC1155_currency
          )

          tx = await tx.wait()
          busy.done()
        } catch (e) {
          busy.hide()
        }
      }
      pages.select('market')
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

  custom-tab {
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
      <custom-input data-input="ERC1155_address" placeholder="address"></custom-input>
      <custom-input data-input="ERC1155_tokenId" placeholder="tokenId"></custom-input>
      <custom-input data-input="ERC1155_id" placeholder="id"></custom-input>
      <custom-input data-input="ERC1155_price" placeholder="price"></custom-input>
      <custom-input data-input="ERC1155_currency" placeholder="currency (0x0 for BNB or any address)"></custom-input>
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

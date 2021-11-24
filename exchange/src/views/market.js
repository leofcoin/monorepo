import './../array-repeat'
import './../elements/fab'
import './../elements/dialog'
import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import PLATFORM_ABI from './../../../abis/platform'

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
      this.sqs('custom-tabs').addEventListener('selected', this._onSelected)
      // console.log(await api.contract.callStatic.listingLength());
    })()
  }

  async _onClick(event) {
    const target = event.composedPath()[0]
    if (target.dataset.event === 'list') {
      if (!api.connection) {
        await api.connectWallet()
      }
      const result = await this.sqs('dialog-element').show()
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
          tx = await contract.setApprovalForAll(api.addresses.exchangeFactory, true)
          await tx.wait()
        }

        tx = await api.contract.listERC1155(
          result.value.ERC1155_address,
          result.value.ERC1155_tokenId,
          result.value.ERC1155_id,
          result.value.ERC1155_price,
          result.value.ERC1155_currency == '0x0' ? '0x0000000000000000000000000000000000000000' : result.value.ERC1155_currency
        )

      }
      console.log(tx);
      tx = await tx.wait()
    }
  }
  _onSelected(event) {
    this.sqs('custom-pages').select(event.detail)
  }

  get template() {
    return html`
<style>
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
</style>
<array-repeat></array-repeat>

<fab-element data-event="list"></fab-element>
<dialog-element>
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
</dialog-element>

    `
  }
})

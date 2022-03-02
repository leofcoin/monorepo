
import abi from './../../../abis/artonline'
import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'
export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this.onselect = this.onselect.bind(this)
  }

  get _tabs() {
    return this.shadowRoot.querySelector('custom-tabs')
  }

  connectedCallback() {
    this._init()
    this.burns = []
    this.mints = []
    this._tabs.addEventListener('selected', this.onselect)
  }

  get burnAddress() {
    return '0x0000000000000000000000000000000000000000'
  }

  get contractaddress() {
    return '0x535e67270f4FEb15BFFbFE86FEE308b81799a7a5'
  }

  get fromBlock() {
    return 11399032
  }

  get toBlock() {
    return 14086225
  }



  async totalBurnAmount() {
    const response = await fetch('https://api.artonline.site/token/totalBurnAmount')
    return Number(await response.text())
  }

  async totalAmountInUSD(amount) {
    return `${Math.round(this.price * amount * 100) / 100} USD`
  }

  async totalMintAmount() {
    const response = await fetch('https://api.artonline.site/token/totalMintAmount')
    return Number(await response.text())
  }

  async getMints(period = 'all') {
    let response = await fetch(`https://api.artonline.site/token/mints?period=${period}`)
    response = await response.json()
    return response
  }

  async getBurns(period = 'all') {
    let response = await fetch(`https://api.artonline.site/token/burns?period=${period}`)
    response = await response.json()
    return response
  }

  async _init() {
    const mints = await this.getMints('all')
    const burns = await this.getBurns('all')

    const response = await fetch('https://api.artonline.site/token/price')
    this.price = Number(await response.text())

    this.shadowRoot.querySelector('[info="totalBurnAmount"]').innerHTML = burns.amount
    this.shadowRoot.querySelector('[info="totalBurnAmountInUSD"]').innerHTML = await this.totalAmountInUSD(burns.amount)

    this.shadowRoot.querySelector('[info="totalMintAmount"]').innerHTML = mints.amount
    this.shadowRoot.querySelector('[info="totalMintAmountInUSD"]').innerHTML = await this.totalAmountInUSD(mints.amount)

    this.totalSupply = mints.amount - burns.amount
    this.shadowRoot.querySelector('[info="totalSupply"]').innerHTML = this.totalSupply
    this.shadowRoot.querySelector('[info="totalSupplyInUSD"]').innerHTML = await this.totalAmountInUSD(this.totalSupply)

    this.shadowRoot.querySelector('[info="priceInUSD"]').innerHTML = this.price
  }

  async onselect() {


    const mints = await this.getMints(this._tabs.selected)
    const burns = await this.getBurns(this._tabs.selected)

    console.log(mints);
    console.log(burns);
    const response = await fetch('https://api.artonline.site/token/price')
    this.price = Number(await response.text())
    this.shadowRoot.querySelector('[info="totalBurnAmount"]').innerHTML = burns.amount
    this.shadowRoot.querySelector('[info="totalBurnAmountInUSD"]').innerHTML = await this.totalAmountInUSD(burns.amount)
    this.shadowRoot.querySelector('[info="totalMintAmount"]').innerHTML = mints.amount
    this.shadowRoot.querySelector('[info="totalMintAmountInUSD"]').innerHTML = await this.totalAmountInUSD(mints.amount)

    // this.totalSupply = mints.amount - burns.amount
    // this.shadowRoot.querySelector('[info="totalSupply"]').innerHTML = this.totalSupply
    // this.shadowRoot.querySelector('[info="totalSupplyInUSD"]').innerHTML = await this.totalAmountInUSD(this.totalSupply)

    this.shadowRoot.querySelector('[info="priceInUSD"]').innerHTML = this.price
  }

  get template() {
    return html`
<style>
  * {
    font-family: 'Noto Sans', sans-serif;
  }
  :host {
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
  }
  h4 {
    margin: 0;
  }
  section {
    width: 100%;
    max-height: 500px;
    height: 100%;
    padding-bottom: 24px;
  }
  .container {
    background: var(--secondary-background-color);
    max-width: 400px;
    border-radius: 48px;
    box-shadow: 0 0 7px 9px #00000012;
    overflow: hidden;
  }
  .container, section {
    display: flex;
    flex-direction: column;
    width: 100%;


    align-items: center;
    justify-content: center;
  }

  flex-row {
    width: 100%;
    align-items: center;

    box-sizing: border-box;
    padding: 0 48px;
  }

  .top {
    padding-top: 24px;
    background: #573e6a;
    color: #eee;
  }

  button {
    background: #573e6a;
    padding: 12px 24px;
    box-sizing: border-box;
    border-radius: 12px;
    color: #eee;
    border-color: #eee;
    font-weight: 700;
    text-transform: uppercase;
    pointer-events: auto;
    cursor: pointer;
  }

  flex-column {
    width: 100%;
    height: 100%;
  }
  [info="price"], [info="totalSupply"] {
    font-weight: 600;
    font-size: 24px;
    color: #9140cf;
  }

  [info="totalMintAmount"] {
    font-weight: 600;
    font-size: 24px;
    color: green;
  }

  [info="totalBurnAmount"] {
    font-weight: 600;
    font-size: 24px;
    color: red;
  }

  .logo {
    height: 24px;
    width: 24px;
    padding: 12px;
    pointer-events: auto;
  }

  custom-pages, .section {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  custom-tabs, custom-tab {
    height: 34px;
    --tab-underline-color: var(--accent-color);
  }

  custom-tabs {
    pointer-events: auto;
  }

  custom-tab * {
    pointer-events: none;
  }
</style>
<section class="container">
  <flex-column class="top" style="max-height: 96px;width: 100%;

  box-sizing: border-box;
  padding: 0 48px;">
    <h4 style="padding-top: 24px;">Statistics</h4>
    <flex-one></flex-one>
    <span info="count"></span>

    <custom-tabs attr-for-selected="data-route">
      <custom-tab data-route="all"><span>all</span></custom-tab>
      <custom-tab data-route="24h"><span>24h</span></custom-tab>
      <custom-tab data-route="week"><span>week</span></custom-tab>
      <custom-tab data-route="year"><span>year</span></custom-tab>
    </custom-tabs>
  </flex-column>
  <custom-pages>
  <span class="section">
  <flex-one></flex-one>
  <flex-row style="align-items: baseline; padding: 24px 48px;">
    <flex-column style="width: 192px;">
      <h4>Burned</h4>
    </flex-column>


    <flex-one></flex-one>
    <flex-column>

      <flex-row style="padding:0;">
      <flex-one></flex-one>
        <span info="totalBurnAmount">0</span>
        <img class="logo" src="https://assets.artonline.site/arteon.svg">
      </flex-row>

      <flex-row style="padding-right:12px;">
      <flex-one></flex-one>
        <span>+-</span>
        <span info="totalBurnAmountInUSD">0</span>
      </flex-row>
    </flex-column>
  </flex-row>
  <flex-row style="align-items: baseline; padding: 0 48px 24px 48px;">
    <flex-column style="width: 192px;">
      <h4>Minted</h4>
    </flex-column>


    <flex-one></flex-one>
    <flex-column>

      <flex-row style="padding:0;">
        <flex-one></flex-one>
        <span info="totalMintAmount">0</span>
        <img class="logo" src="https://assets.artonline.site/arteon.svg">
      </flex-row>

      <flex-row style="padding-right:12px;">
        <flex-one></flex-one>
        <span>+-</span>
        <span info="totalMintAmountInUSD">0</span>
      </flex-row>
    </flex-column>
  </flex-row>

  <flex-row style="align-items: baseline; padding: 0 48px 24px 48px;">
    <flex-column style="width: 192px;">
      <h4>Total Supply</h4>
    </flex-column>


    <flex-one></flex-one>
    <flex-column>

      <flex-row style="padding:0;">
        <flex-one></flex-one>
        <span info="totalSupply">0</span>
        <img class="logo" src="https://assets.artonline.site/arteon.svg">
      </flex-row>

      <flex-row style="padding-right:12px;">
        <flex-one></flex-one>
        <span>+-</span>
        <span info="totalSupplyInUSD">0</span>
      </flex-row>
    </flex-column>
  </flex-row>

  <flex-row style="align-items: baseline; padding: 0 48px 24px 48px; width: 100%;">
    <flex-column style="width: 192px;">
      <h4>Exchange Rate</h4>
    </flex-column>


    <flex-one></flex-one>
    <flex-column>

      <flex-row style="padding:0; width: 100%;">
      <flex-one></flex-one>
        <span info="price">1</span>
        <img class="logo" src="https://assets.artonline.site/arteon.svg">
      </flex-row>

      <flex-row style="padding-right:12px;">
      <flex-one></flex-one>
        <span>+-</span>
        <span info="priceInUSD">0</span>
      </flex-row>
    </flex-column>
  </flex-row>
  <flex-one></flex-one>

  </span>
  </custom-pages>
</section>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})

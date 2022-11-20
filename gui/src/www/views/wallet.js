import './../elements/account'
// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { parseUnits } from './../../../node_modules/@leofcoin/utils/src/utils'


export default customElements.define('wallet-view', class WalletView extends HTMLElement {
  get #amount() {
    return this.shadowRoot.querySelector('.amount')
  }

  get #to() {
    return this.shadowRoot.querySelector('.to')
  }

  get #pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  #accounts

  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  async connectedCallback() {
    this.shadowRoot.addEventListener('click', this.#handleClick.bind(this))
    this.#select('send')
    // console.log(await api.accounts());
    this.#accounts = await api.accounts()
    console.log(this.#accounts);
    this.shadowRoot.querySelector('.accounts').items = this.#accounts.map(val => {
      return {
        name: val[0],
        external: val[1],
        internal: val[2]
      }
    })

    this.#addressSelected({})
    this.shadowRoot.querySelector('custom-selector').addEventListener('selected', this.#addressSelected.bind(this))
  }

  #addressSelected({detail}) {
    if (!detail) detail = this.#accounts[0][1]

    Array.from(this.shadowRoot.querySelectorAll('.address')).forEach(item => {
      item.innerHTML = detail
    })

    this.selectedAccount = detail
  }

  #select(selected) {
    this.#pages.select(selected)
  }

  _cancel() {
    this.#to.value = null
    this.#amount.value = null
  }

  async _send() {
    const to = this.#to.value
    const amount = this.#amount.value
    let from = this.selectedAccount
    const method = 'transfer'
    const token = await api.nativeToken()
    if (to === from) from = await api.peerId()
    const params = [from, to, parseUnits(amount).toString()]
    api.createTransactionFrom([from, token, method, params])
  }

  #handleClick(event) {
    const target = event.composedPath()[0]
    const action = target.getAttribute('data-action')
    action && this[`_${action}`]()
  }

  get template() {
    return `
<style>
  * {
    pointer-events: none;
  }

  :host {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
  }

  .custom-selected {
    background: #7f65929e;
    color: #eee;
  }
  custom-pages {
    width: 100%;
    height: 100%;
  }
  [data-route="send"] {

    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }

  .peer-id {
    border: 1px solid white;
    background: #ffffffbd;
    border-radius: 12px;
    color: #66477c;
    position: absolute;
    /* top: 50%; */
    left: 50%;
    transform: translateX(-50%);
    top: 12px;
  }

  .wallet-nav-container {
    padding: 12px;
    box-sizing: border-box;
    height: 72px;
  }

  .wallet-nav {
    border: 1px solid white;
    background: #ffffff9c;
    border-radius: 12px 6px;
    color: aliceblue;
    padding: 12px 6px;
    box-sizing: border-box;
    align-items: center;
  }

  a {
    padding: 0 12px;
    cursor: pointer;
    --svg-icon-color: #7f6592;
  }

  .container {
    border-radius: 24px;
    padding: 24px;
    box-sizing: border-box;
    background: #ffffff9c;
    color: #7f6592;
    font-size: 18px;
  }

  input {
    margin-top: 12px;
    margin-bottom: 24px;
    background: transparent;
    border: 1px solid #eee;
    font-size: 18px;
  }

  .custom-selector-overlay custom-selector {
    height: 100%;
    width: 256px;
    display: flex;
    flex-direction: column;
  }

  .custom-selector-overlay {
    background: #ffffff8c;
    --svg-icon-color: #66477c;
    border-right: 1px solid #eee;
  }

  .main {
    width: 100%;
  }
  custom-selector flex-row {
    padding: 12px;
    box-sizing: border-box;
    height: 48px;
    width: 100%;
  }

  select, input, button {
    pointer-events: auto;
  }

  select, button {
    cursor: pointer;
  }
</style>
<span class="custom-selector-overlay">
  <custom-selector attr-for-selected="data-address">
    <array-repeat class="accounts">
      <template>
        <account-element data-address="[[item.external]]" name="[[item.name]]" external="[[item.external]]" internal="[[item.internal]]"></account-element>
      </template>
    </array-repeat>
  </custom-selector>
</span>

<flex-column class="main">
  <custom-pages attr-for-selected="data-route">
    <flex-column data-route="send">
      <flex-column class="container">

        <flex-row>
          <label for=".amount">send</label>
          <flex-one></flex-one>
          <select>
            <option>ART</option>
          </select>
        </flex-row>
        <input class="amount" placeholder="1"></input>

        <label for=".to">to</label>
        <input class="to" placeholder="address"></input>

        <flex-one></flex-one>
        <flex-row>
          <button data-action="cancel">cancel</button>
          <flex-one></flex-one>
          <button data-action="send">send</button>
        </flex-row>
      </flex-column>

      <flex-column data-route="receive">
        <clipboard-copy class="address peer-id">
          loading...
        </clipboard-copy>
      </flex-column>
    </flex-column>
  </custom-pages>

  <flex-row class="wallet-nav-container">
    <flex-one></flex-one>
    <flex-row class="wallet-nav">
      <a title="send">
        <custom-svg-icon icon="send"></custom-svg-icon>
      </a>
      <a title="recceive">
        <custom-svg-icon icon="receive"></custom-svg-icon>
      </a>
      <a title="transactions">
        <custom-svg-icon icon="transactions"></custom-svg-icon>
      </a>
    </flex-row>
    <flex-one></flex-one>
  </flex-row>
</flex-column>
    `
  }
})

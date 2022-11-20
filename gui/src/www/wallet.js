export default customElements.define('wallet-element', class WalletElement extends HTMLElement {
  get #amount() {
    return this.shadowRoot.querySelector('.amount')
  }

  get #to() {
    return this.shadowRoot.querySelector('.to')
  }

  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.#handleClick.bind(this))
  }

  _cancel() {
    this.#to.value = null
    this.#amount.value = null
  }

  async _send() {
    const to = this.#to.value
    const amount = this.#amount.value
    const from = await api.peerId()
    // from, to, method, params, nonce
    // api.createTransactionFrom(from, )
  }

  #handleClick(event) {
    const target = event.composedPath()[0]
    const action = target.getAttribute('data-action')
    action && this[`_${action}`]()
  }

  get template() {
    return `
<style>
  :host {
    display: flex;
    flex-direction: flex-row;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }
</style>

<flex-column>
  <label for=".to">to</label>
  <input class="to" placeholder="address"></input>

  <label for=".amount">amount</label>
  <input class="amount" placeholder="1"></input>

  <flex-row>
    <button data-action="cancel">cancel</button>
    <flex-one></flex-one>
    <button data-action="send">send</button>
  </flex-row>
</flex-column>
    `
  }
})

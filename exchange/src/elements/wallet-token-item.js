export default customElements.define('wallet-token-item', class WalletTokenItem extends BaseClass {
  static get observedAttributes() {
    return ['address', 'name', 'symbol', 'balance', 'icon']
  }
  constructor() {
    super()
  }

  attributeChangedCallback(name, old, value) {
    if (value !== old) this[name] = value
  }

  set symbol(value) {
    this.sqs('.symbol').innerHTML = value
  }

  set balance(value) {
    this.sqs('.balance').innerHTML = value
  }

  set icon(value) {
    this.sqs('.icon').src = value
  }

  get template() {
    return html`
  <style>
    :host {
      height: 40px;
      display: flex;
      flex-direction: row;
      pointer-events: auto;
      padding: 12px 24px;
      box-sizing: border-box;
      align-items: center;
      font-size: 24px;
    }

    img {
      height: 24px;
      padding-right: 12px;
    }
  </style>

  <img class="icon"></img>
  <span class="symbol"></span>
  <flex-one></flex-one>
  <span class="balance"></span>

    `
  }
})

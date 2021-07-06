export default customElements.define('wallet-view', class WalletView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  connectedCallback() {
    // this._select({detail: api.addresses.pools.GENESIS})
  }
  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
    </style>

    <custom-pages>
      <section data-route="connect">
        <button>connect metamask</button>
        <button>create wallet</button>
      </section>
      <section data-route="create-wallet">

        <custom-input placeholder="password"></custom-input>
        <button>create wallet</button>
      </section>
    </custom-pages>
    `
  }
})

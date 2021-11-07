import {elevation2dp} from './../styles/elevation'

export default customElements.define('wallet-view', class WalletView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._select = this._select.bind(this)
  }

  connectedCallback() {
    this._selector.addEventListener('selected', this._select)
    // this._select({detail: api.addresses.pools.GENESIS})
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  _select({detail}) {
    this._pages.select(detail)
  }
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        --svg-icon-color: var(--main-color);
      }

      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
        height: 40px;
        text-transform: uppercase;
        width: 196px;
        justify-content: center;
        pointer-events: auto;
      }

      section {
        align-items: center;
        justify-content: center;
      }

      .container {
        display: flex;
        flex-direction: column;
        min-height: 320px;
        max-width: 320px;
        border-radius: 24px;
        box-sizing: border-box;
        padding: 48px;
        background: var(--custom-drawer-background);

        ${elevation2dp}
        box-shadow: 0 1px 18px 0px var(--accent-color);
      }
    </style>

    <custom-pages attr-for-selected="data-route">
      <section data-route="connect">
        <custom-selector class="container" attr-for-selected="data-route">
          <button data-route="login">
            <custom-svg-icon icon="account-circle"></custom-svg-icon>
            <flex-one></flex-one>
            login
          </button>

          <flex-one></flex-one>

          <button data-route="connect">
            <custom-svg-icon icon="settings-input-hdmi"></custom-svg-icon>
            <flex-one></flex-one>
            connect
          </button>

          <button data-route="create">
            <custom-svg-icon icon="build"></custom-svg-icon>
            <flex-one></flex-one>
            create
          </button>
          <button data-route="recover">
            <custom-svg-icon icon="autorenew"></custom-svg-icon>
            <flex-one></flex-one>
            recover
          </button>
        </custom-selector>
      </section>

      <section data-route="create">
        <span class="container">
          <custom-input placeholder="password"></custom-input>
          <button>create wallet</button>
        </span>
      </section>

      <section data-route="login">
        <span class="container">
          <custom-input placeholder="account"></custom-input>
          <custom-input placeholder="password"></custom-input>
          <button>login</button>
        </span>
      </section>

      <section data-route="recover">
        <span class="container">
          <custom-input placeholder="mnemonic"></custom-input>
          <button>recover</button>
        </span>
      </section>


    </custom-pages>
    `
  }
})

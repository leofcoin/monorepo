import './../node_modules/custom-svg-iconset/src/custom-svg-iconset'
import './../node_modules/custom-svg-icon/src/custom-svg-icon'
import './views/home'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import './../node_modules/custom-pages/src/custom-pages'
import './../node_modules/custom-selector/src/index'
import './../node_modules/ethers/dist/ethers.esm'
import addresses from './../../addresses/addresses/binance-smartchain'

globalThis.ethers = _ethers

globalThis.api = globalThis.api || {
  addresses
}
export default customElements.define('art-online', class ArtOnline extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this._render()
    this._toggleDrawer = this._toggleDrawer.bind(this)
    this._onSelect = this._onSelect.bind(this)
  }

  connectedCallback() {
    this.shadowRoot.querySelector('.menu-button').addEventListener('click', this._toggleDrawer)
    this.shadowRoot.querySelector('custom-selector').addEventListener('selected', this._onSelect)
  }

  async _onSelect(event) {
    !customElements.get(`${event.detail}-view`) && await import(`./${event.detail}.js`)

    this.removeAttribute('drawer-open')
    this.shadowRoot.querySelector('custom-pages').select(event.detail)
    event.detail === 'buy' ? this.setAttribute('connect', '') : this.removeAttribute('connect')

  }

  _toggleDrawer() {
    this.hasAttribute('drawer-open') ?
      this.removeAttribute('drawer-open') :
      this.setAttribute('drawer-open', '')
  }

  _render() {
    this.shadowRoot.innerHTML = `
    <style>
      * {
        user-select: none;
        pointer-events: none;
      }
      :host {
        font-family: 'Noto Sans', sans-serif;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      main {
        display: flex;
        height: 100%;
        width: 100%;
      }

      custom-pages {
        margin-top: 24px;
        box-sizing: border-box;
        display: flex;
      }

      .toolbar {
        /* margin-top: 24px; */
        /* margin-left: 24px; */
        /* margin-right: 24px; */
        /* background: aliceblue; */
        border-radius: 24px;
        align-items: center;
        box-sizing: border-box;
        padding: 12px 24px;
        z-index: 1000;
        max-width: 840px;
        width: calc(100% - 48px);
      }

      h1 {
        margin: 0;
        padding: 0;
        font-size: 28px;
      }

      a {
        text-decoration: none;
        color: aliceblue;
      }

      .logo {
        height: 36px;
        margin-bottom: 12px;
      }

      .nav-item {
        padding: 12px 24px;
        box-sizing: border-box;
        color: #333;
        text-transform: uppercase;
        cursor: pointer;
        pointer-events: auto;
      }
      .nav-item.app {
        background: linear-gradient(128.17deg, #BD00FF -14.78%, #FF1F8A 110.05%);
        border-radius: 24px;
        z-index: 100;
        color: aliceblue;
      }

      .wrapper {
        width: 100%;
        height: 100%;
        padding: 48px 0;
        box-sizing: border-box;
      }

      custom-selector {
        display: flex;
        flex-direction: column;
        background: aliceblue;
        height: 100%;
        border-top-right-radius: 24px;
        border-bottom-right-radius: 24px;
        padding: 24px 0 24px 0;
        box-sizing: border-box;
      }

      .drawer {
        box-sizing: border-box;
        z-index: 1000;
        width: 0;
        opacity: 0;
        pointer-events: none;
        overflow: hidden;
      }

      .menu-button {
        opacity: 1;
        pointer-events: auto;
        cursor: pointer;
        position: absolute;
        left: 24px;
        top: 12px;
        --svg-icon-color: aliceblue;
        --svg-icon-size: 40px;
      }

      :host([drawer-open]) .drawer {
        position: absolute;
        left: 0;
        top: 72px;
        width: 248px;
        opacity: 1;
        pointer-events: auto;
        border: 1px solid #d41594;
        border-top-right-radius: 24px;
        border-bottom-right-radius: 24px;
      }

      @media (min-width: 620px) {
        .install-wallet {
          flex-direction: row;
          height: 40px;
        }
      }

      @media (min-width: 1200px) {
        .menu-button {
          opacity: 0;
          pointer-events: none;
        }
        .drawer {
          opacity: 1;
          pointer-events: auto;
          width: 248px;
        }
        .toolbar {
          margin-left: 0;
          margin-right: 0;
        }
      }

      .connect {
        background: #ff1f8a;
        color: aliceblue;
        position: absolute;
        top: 12px;
        right: 24px;
        border-radius: 24px;
        box-sizing: border-box;
        padding: 12px 24px;
        border-color: white;
        cursor: pointer;
        text-transform: uppercase;
        opacity: 0;
      }

      :host([connect]) .connect {
        opacity: 1;
        pointer-events: auto;
      }

      a img {
        height: 32px;
        width: 32px;
        cursor: pointer;
        pointer-events: auto;
      }

    </style>
    <slot></slot>
    <custom-svg-icon icon="menu" class="menu-button"></custom-svg-icon>
    <!-- <button class="connect">connect wallet</button> -->
    <flex-row class="wrapper">
      <flex-column class="drawer">
        <custom-selector attr-for-selected="data-route">
          <flex-column style="align-items: center;">
            <flex-row style="align-items: flex-start; color: aliceblue;">
              <img class="logo" src="./assets/arteon.svg" alt="ArtOnline"  title="ArtOnline"></img>
            </flex-row>
          </flex-column>

          <span data-route="home" class="nav-item">
            home
          </span>

          <span data-route="buy" class="nav-item">
            buy
          </span>

          <a data-route="token-contract" href="https://bscscan.com/address/0x535e67270f4feb15bffbfe86fee308b81799a7a5" class="nav-item">
            token contract
          </a>

          <a data-route="platform-contract" href="https://bscscan.com/address/0x9D0F9765c2e912088b682DA9eaf7439a9440a6e4" class="nav-item">
            platform contract
          </a>

          <a data-route="whitepaper" href="./whitepaper.pdf" class="nav-item">
            whitepaper
          </a>

          <flex-one></flex-one>

            <flex-column style="align-items: center;">
              <a href="https://app.artonline.site" class="nav-item app">
                open app
              </a>
            </flex-column>


        </custom-selector>
        <flex-row style="background: #3d326abf; padding: 12px; box-sizing: border-box;">
          <flex-two></flex-two>
          <a href="https://twitter.com/ArteonToken" title="Follow us on Twitter!">
            <img src="./assets/social/twitter-white.svg"></img>
          </a>
          <flex-one></flex-one>
          <a href="https://t.me/ARTEONDEFI" title="Join us on Telegram!">
            <img src="./assets/social/telegram-white.svg"></img>
          </a>
          <flex-one></flex-one>
          <a href="https://discord.gg/95qJqkdCts" title="Let's discuss on Discord!">
            <img src="./assets/social/discord-white.svg"></img>
          </a>
          <flex-two></flex-two>
        </flex-row>
      </flex-column>
      <main>
        <custom-pages  attr-for-selected="data-route">
          <home-view data-route="home"></home-view>
          <buy-view data-route="buy"></buy-view>
        </custom-pages>
      </main>
    </flex-row>
    `
  }
})

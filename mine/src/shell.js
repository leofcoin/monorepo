import './../node_modules/custom-svg-iconset/custom-svg-iconset'
import './../node_modules/custom-svg-icon/custom-svg-icon'
import './../node_modules/custom-pages/src/custom-pages'
import './../node_modules/custom-selector/src/index'
import arteonAddresses from './../../addresses/addresses'
import Api from './api'
import './../node_modules/custom-drawer/custom-drawer'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import {elevation2dp} from './styles/elevation'

globalThis._contracts = globalThis._contracts || []

export default customElements.define('mine-shell', class extends HTMLElement {

  static get observedAttributes() {
    return ['desktop']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this[name] = newValue
  }
  set desktop(value) {
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._select = this._select.bind(this)
    this._loadAccounts = this._loadAccounts.bind(this)

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jdenticon@3.1.0/dist/jdenticon.min.js'
    script.setAttribute('async', '')
    script.setAttribute('integrity', 'sha384-VngWWnG9GS4jDgsGEUNaoRQtfBGiIKZTiXwm9KpgAeaRn6Y/1tAFiyXqSzqC8Ga/')
    script.setAttribute('crossorigin', 'anonymous')

    document.head.appendChild(script)
    this._onMenuButtonClick = this._onMenuButtonClick.bind(this)
    this._init()
  }

  connectedCallback() {
    this.shadowRoot.querySelector('custom-svg-icon[icon="menu"]').addEventListener('click', this._onMenuButtonClick)
  }

  _onMenuButtonClick() {
    this.hasAttribute('drawer-opened') ? this.removeAttribute('drawer-opened') : this.setAttribute('drawer-opened', '')
  }

  _networkNameFor(version) {
    const networksByVersion = {
      0: 'mainnet',
      3: 'ropsten',
      42: 'kovan',
      7475: 'wapnet'
    }

    return networksByVersion[version]
  }


  async _loadAccounts(accounts) {
    const provider = new ethers.providers.Web3Provider(ethereum)
    console.log(provider);
    const signer = await provider.getSigner()
    const networkVersion = Number(ethereum.networkVersion)
    console.log(networkVersion);
    if (accounts[0] === this.address && api.chainId === Number(ethereum.networkVersion)) return
    globalThis.api = await new Api(signer)
    this.address = api.signer.address
    api.chainId = Number(ethereum.networkVersion)
    api.addresses = await arteonAddresses(this._networkNameFor(api.chainId))
    // jdenticon.update(this.shadowRoot.querySelector('.avatar'), accounts[0])
  }

  async setTheme(theme) {
    const importee = await import(`./themes/${theme}.js`)
    for (const prop of Object.keys(importee.default)) {
      document.querySelector('body').style.setProperty(`--${prop}`, importee.default[prop])
    }

    return
  }

  async _init() {

    await this.setTheme('dark')

    const updatePlatform = ({matches}) => {
      if (matches) {
        this.removeAttribute('desktop')
        this.removeAttribute('drawer-opened')
        return
      }
      this.setAttribute('desktop', '')
      this.setAttribute('drawer-opened', '')
    }

    const desktop = globalThis.matchMedia('(max-width: 1200px)')
    updatePlatform(desktop)
    desktop.addListener(updatePlatform)


    // await import('./views/login.js')
    await import('./third-party/ethers.js')

    const accounts = await ethereum.request({method: 'eth_requestAccounts'})
    await this._loadAccounts(accounts)

    ethereum.on('accountsChanged', this._loadAccounts)
    ethereum.on('chainChanged', this._loadAccounts)

    this._selector.addEventListener('selected', this._select)

    this._select({detail: 'pools'})
    import('./exchange.js')
  }

  async _select({detail}) {
    const tag = `${detail}-view`
    console.log(detail);

    if (!customElements.get(tag)) await import(`./${detail}.js`)
    if (!this.hasAttribute('desktop')) this.removeAttribute('drawer-opened')
    this._pages.select(detail)
  }

  get template() {
    return `
    <style>
    * {
      pointer-events: none;
      user-select: none;
      outline: none;
    }
    :host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      background: var(--main-background-color);
    }
    .container {
      position: absolute;
      display: flex;
      flex-direction: column;
      left: 0;
      right: 0;
      bottom: 0;
      top: 72px;
    }

    .avatar {
      max-height: 48px;
      border-radius: 50%;
      position: absolute;
      right: 12px;
      top: 12px;
    }

    custom-selector {
      cursor: pointer;
    }

    header {
      display: flex;
      height: var(--main-header-height);
      background: var(--main-background-color);
      color: var(--main-color);
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      padding: 12px 24px;
      box-sizing: border-box;
      align-items: center;
    }

    .logo {
      width: 48px;
      height: 48px;
    }

    custom-selector {
      height: 100%;
      background: var(--custom-drawer-background);
      padding: 48px 0 24px 24px;
      box-sizing: border-box;
    }

    .drawer-item {
      pointer-events: auto;
      font-size: 20px;
      font-weight: 700;
      text-transform: uppercase;
      align-items: center;
      display: flex;
      --svg-icon-size: 24px;
      --svg-icon-color: var(--main-color);
      color: var(--main-color);
      padding: 12px;
      box-sizing: border-box;
    }

    .drawer-item custom-svg-icon {
      padding-right: 12px;
    }

    .drawer-item.custom-selected {
      background: var(--accent-color);
      border-top-left-radius: 24px;
      border-bottom-left-radius: 24px;
      color: #eee;
      --svg-icon-color: #eee;
    }

    custom-drawer {
      height: calc(100% - var(--main-header-height) - 48px);
      transform: translateX(-110%);
      border-top-right-radius: 44px;
      border-bottom-right-radius: 44px;
      top: 96px;
      position: absolute;
      overflow: hidden;
      z-index: 10000;
      ${elevation2dp}
    }

    :host([drawer-opened]) custom-drawer {
      opacity: 1;
      transform: translateX(0);
    }

    :host([drawer-opened][desktop]) .container {
      opacity: 1;
      left: var(--custom-drawer-width);
    }

    header h1 {
      padding-left: 24px;
      text-transform: capitalize;
      font-weight: 700;
      font-size: 44px;
      letter-spacing: 12px;
    }

    a img {
      width: 32px;
    }

    a {
      pointer-events: auto;
    }

    flex-row[slot="footer"] {
      display: flex !important;
      align-items: center;
      padding: 12px;
      box-sizing: border-box;
    }

    custom-svg-icon[icon="menu"] {
      --svg-icon-color: var(--main-color);
      --svg-icon-size: 48px;
      position: absolute;
      left: 24px;
      top: 24px;
      pointer-events: auto;
    }

    :host([drawer-opened][desktop]) custom-svg-icon[icon="menu"] {
      pointer-events: none;
      opacity: 0;
    }

    .title, .middle-title {
      align-items: center;
    }

    header .title {
      position: absolute;
      transform: translateX(-50%);
      left: 50%;
      top: 24px;
      height: 54px;
    }

    :host([desktop]) header .title {
      transform: translate(0);
      left: 24px;
      top: 24px;
    }

    </style>
    <custom-svg-iconset>
      <svg><defs>
        <g id="add"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></g>
        <g id="add-shopping-cart"><path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9.83-3.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4h-.01l-1.1 2-2.76 5H8.53l-.13-.27L6.16 6l-.95-2-.94-2H1v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.13 0-.25-.11-.25-.25z"></path></g>
        <g id="attach-money"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"></path></g>
        <g id="arrow-back"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></g>
        <g id="arrow-drop-down"><path d="M7 10l5 5 5-5z"></path></g>
        <g id="assessment"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"></path></g>
        <g id="close"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></g>
        <g id="compare-arrows"><path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"></path></g>
        <g id="delete"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></g>
        <g id="build"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path></g>
        <g id="done"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path></g>
        <g id="remove-shopping-cart"><path d="M22.73 22.73L2.77 2.77 2 2l-.73-.73L0 2.54l4.39 4.39 2.21 4.66-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h7.46l1.38 1.38c-.5.36-.83.95-.83 1.62 0 1.1.89 2 1.99 2 .67 0 1.26-.33 1.62-.84L21.46 24l1.27-1.27zM7.42 15c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h2.36l2 2H7.42zm8.13-2c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H6.54l9.01 9zM7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2z"></path></g>
        <g id="swap-horiz"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"></path></g>
        <g id="local-offer"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"></path></g>
        <g id="menu"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path></g>
        <g id="memory"><path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"></path></g>
        <g id="playlist-add"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"></path></g>
      </defs></svg>
    </custom-svg-iconset>
    <custom-drawer>
      <custom-selector slot="content" attr-for-selected="data-route">
        <span class="drawer-item" data-route="pools">
          <custom-svg-icon icon="assessment"></custom-svg-icon>
          <span>pools</span>
        </span>

        <span class="drawer-item" data-route="exchange">
          <custom-svg-icon icon="swap-horiz"></custom-svg-icon>
          <span>exchange</span>
        </span>

        <span class="drawer-item" data-route="auction">
          <custom-svg-icon icon="attach-money"></custom-svg-icon>
          <span>auction</span>
        </span>

        <!-- <span class="drawer-item" data-route="buy-arteon">
          <custom-svg-icon icon="local-offer"></custom-svg-icon>
          <span>buy arteon</span>
        </span>
        -->
      </custom-selector>

      <flex-row slot="footer">
        <flex-two></flex-two>
        <a href="https://twitter.com/ArteonToken" title="Follow us on Twitter!">
          <img src="./assets/social/twitter-white.svg"></img>
        </a>
        <flex-one></flex-one>
        <a href="https://t.me/ARTEONDEFI" title="Join us on Telegram!">
          <img src="./assets/social/telegram-white.svg"></img>
        </a>
        <flex-one></flex-one>
        <a href="https://discord.com/invite/gxZAJNg8cM" title="Let's discuss on Discord!">
          <img src="./assets/social/discord-white.svg"></img>
        </a>
        <flex-two></flex-two>
      </flex-row>
    </custom-drawer>
    <!-- <canvas class="avatar"></canvas> -->

    <header>
      <flex-row class="title">
        <img class="logo" src="./assets/arteon-dark.png"></img>
        <h1>arteon</h1>
      </flex-row>
    </header>
    <span class="container">
      <custom-pages attr-for-selected="data-route">
        <exchange-view data-route="exchange"></exchange-view>
        <pools-view data-route="pools"></pools-view>
        <buy-arteon-view data-route="buy-arteon"></buy-arteon-view>
      </custom-pages>
    </span>

    <custom-svg-icon icon="menu"></custom-svg-icon>
    `
  }
})

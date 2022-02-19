import miniframe from './miniframe'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import './elements/search'
import './array-repeat'
import icons from './ui/icons'
import header from './ui/header'
import pages from './ui/pages'
import drawer from './ui/drawer'
import './elements/connect'
import './elements/busy'
import Router from './router'
import TokenList from './../node_modules/@coinsswap/token-list/token-list.mjs'
import './../node_modules/custom-tabs/custom-tabs'
import './../node_modules/custom-tabs/custom-tab'
import './../node_modules/@andrewvanardennen/custom-input/custom-input'
import controller from './../../elements/ipfs-controller/controller'
import { version } from './../package.json'

globalThis.isApiReady = () => new Promise((resolve, reject) => {
  if (globalThis.api && globalThis.api.ready) resolve();
  pubsub.subscribe('api.ready', () => {
    resolve()
  })
});

export default customElements.define('exchange-shell', class ExchangeShell extends BaseClass {
  get pages() {
    return this.sqs('custom-pages')
  }
  constructor() {
    super()
    this._onclick = this._onclick.bind(this)
    controller()
  }

  connectedCallback() {
    this.setTheme('dark')
    globalThis.showCountDown = countdown => new Promise((resolve, reject) => {
      location.href = '#!/countdown'
      console.log(this.sqs('countdown-view'));
      console.log(countdown);
      this.sqs('countdown-view').setAttribute('value', countdown)
      setTimeout(() => {
        resolve()

        location.href = '#!/market'
      }, countdown);
    })

    globalThis.busy = this.sqs('busy-element')
    this._init()
  }

  async _init() {
    this.shadowRoot.querySelector('.version').innerHTML = `v${version}`
    if (!globalThis.tokenLists) {
      globalThis.tokenList = {
        selected: 'pancakeswap'
      }
      let tokens = await new TokenList(globalThis.tokenList.selected, 'mainnet');

      globalThis.tokenList.tokens = tokens
      console.log(tokens);
    }

    globalThis.router = new Router(this.pages)

    const importee = await import('./api.js')
    globalThis.api = new importee.default()
    this.addEventListener('click', this._onclick)


  }

  _toggleDrawer() {
    if (this.getBoundingClientRect().width >= 960) return

    this.hasAttribute('open-drawer') ? this.removeAttribute('open-drawer') : this.setAttribute('open-drawer', '')
  }

  _onclick(event) {
    const target = event.composedPath()[0]
    if (target.hasAttribute('icon') && target.getAttribute('icon') === 'menu') {
      this._toggleDrawer()
      return
    }
    if (target.classList.contains('nav-item') && !target.hasAttribute('data-menu')) {
      this._toggleDrawer()
      return
    }
    if (target.hasAttribute('data-menu')) {
      const menu = target.getAttribute('data-menu')
      const submenus = Array.from(this.shadowRoot.querySelectorAll(`[data-submenu="${menu}"]`))
      if (target.hasAttribute('opened')) {
        target.removeAttribute('opened')
        submenus.forEach((sub) => {
          sub.removeAttribute('shown')
        });
      } else {
        target.setAttribute('opened', '')
        submenus.forEach((sub) => {
          sub.setAttribute('shown', '')
        });
      }
    }
  }

  async setTheme(theme) {
    const importee = await import(`./themes/${theme}.js`)
    for (const prop of Object.keys(importee.default)) {
      document.querySelector('body').style.setProperty(`--${prop}`, importee.default[prop])
    }

    return
  }

  get template() {
    return html`
<style>
  * {
    user-select: none;
    pointer-events: none;
  }
  :host {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    background: var(--main-background-color);
    --svg-icon-color: #eee;
  }
  h1, h2 {
    margin: 0;
  }

  h2 {
    font-weight: 700;
    font-size: 18px;
  }

  [center] {
    align-items: center;
  }

  a {
    text-decoration: none;
    color: var(--main-color);
    cursor: pointer;
    /* pointer-events: auto; */
  }

  .logo {
    height: 32px;
    width: 32px;
    padding: 12px;
  }

  header {
    display: flex;
    height: var(--header-height, 70px);
    box-sizing: border-box;
    padding: 0 24px;
    ${miniframe.styles.elevation.elevation4dp}

    /* box-shadow: 0 1px 18px 0px var(--accent-color); */
  }
  .nav-item {
    padding: 0 8px;
  }

  .nav-item.avatar {
    padding: 0;
  }

  search-element.desktop {
    opacity: 0;
    width: 0px;
    pointer-events: none;
  }

  search-element.mobile {
    opacity: 1;
    height: auto;
    pointer-events: auto;
  }

  .mobile-search {
    padding: 24px;
    box-sizing: border-box;
  }

  button {
    display: flex;
    background: transparent;
    padding: 6px 12px;
    box-sizing: border-box;
    border-radius: 12px;
    align-items: center;
    cursor: pointer;
    text-transform: uppercase;
  }

  button strong {
    padding-left: 12px;
  }

  connect-element custom-selector {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
  }

  [data-route="metamask"] img {
    height: 24px;
    width: 24px;
  }

  .avatar {
    max-height: 30px;
    border-radius: 50%;
    z-index: 1000;
    position: absolute;
    top: 20px;
    right: 12px;
  }
  .nav-bar {
    padding-right: 44px;
  }

  [icon="menu"] {
    pointer-events: auto;
    --svg-icon-size: 44px;
  }
  @media (min-width: 960px) {
    search-element.desktop {
      opacity: 1;
      width: 100%;
      pointer-events: auto;
    }
    search-element.mobile {
      opacity: 0;
      height: 0px;
      pointer-events: none;
    }
    .mobile-search {
      padding: 0;
      height: 0;
    }
  }

  custom-pages {
    top: 54px;
    right: 0;
    bottom: 0;
    left: 0;
    position: absolute;
  }

  :host([open-drawer]) .drawer {
    right: 0 !important;
    opacity: 1 !important;
    width: 264px !important;
    z-index: 100;
    top: 54px;
    pointer-events: auto;
  }

  @media (min-width: 960px) {
    [icon="menu"] {
      opacity: 0;
      pointer-events: none;
    }
    .drawer {
      top: 0;
      right: 0 !important;
      opacity: 1 !important;
      width: 264px !important;
      pointer-events: auto !important;
    }
    .nav-item {
      pointer-events: auto !important;
    }
    custom-pages {
      left: 264px;
      width: calc(100% - 264px);
    }
  }
  .version {
    position: absolute;
    pointer-events: none;
    cursor-select: none;
    left: 12px;
    bottom: 12px;
    font-size: 12px;
    color: #eee;
  }

</style>
${icons}
<flex-row center>
  <custom-svg-icon icon="menu"></custom-svg-icon>
  <flex-one></flex-one>
  <img class="logo" src="https://assets.artonline.site/arteon.svg"></img>
</flex-row>
${pages}
${drawer}

<connect-element>
  <strong slot="title">Connect Wallet</strong>

  <custom-selector attr-for-selected="metamask">
    <button data-route="metamask" data-confirm="metamask">
      <img src="https://assets.artonline.site/metamask-fox.svg"></img>
      <strong>metamask</strong>
    </button>
  </custom-selector>
</connect-element>

<busy-element></busy-element>

<span class="version"></span>
    `
  }
})

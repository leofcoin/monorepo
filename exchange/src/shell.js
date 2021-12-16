import miniframe from './miniframe'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import './elements/search'
import icons from './ui/icons'
import header from './ui/header'
import pages from './ui/pages'
import './elements/connect'
import './elements/busy'


globalThis.isApiReady = () => new Promise((resolve, reject) => {
  if (Object.keys(pubsub.subscribers).length > 0 && pubsub.subscribers['api.ready']?.['value']) resolve()
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
  }

  connectedCallback() {
    this.setTheme('dark')
    globalThis.onhashchange = async () => {
      if (location.hash === '') {
        if (this._isFirstVisit()) location.href = `#!/market` // TODO: home!
        else location.href = `#!/market`
      }
      const hash = location.hash.slice(3, location.hash.length)
      const parts = hash.split('/')
      if (!customElements.get(`${parts[0]}-view`)) await import(`./${parts[0]}.js`)
      this.pages.select(parts[0])
    }
    onhashchange()
    globalThis.busy = this.sqs('busy-element')
    this._init()
  }

  async _init() {
    const importee = await import('./api.js')
    globalThis.api = new importee.default()
  }

  _isFirstVisit() {
    let visited = localStorage.getItem('visited')
    if (!visited) localStorage.setItem('visited', true)
    return Boolean(visited) ? false : true
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
    height: 100%;
    width: 100%;
    background: var(--main-background-color);
  }

  h1, h2 {
    margin: 0;
  }

  h2 {
    font-weight: 700;
  }

  [center] {
    align-items: center;
  }

  a {
    text-decoration: none;
    color: var(--main-color);
    cursor: pointer;
    pointer-events: auto;
  }

  .logo {
    display: flex;
  }

  .logo img {
    height: 36px;
    width: 36px;
    padding-right: 6px;
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
    pointer-events: auto;
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
</style>
${icons}
${header}
${pages}
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
    `
  }
})

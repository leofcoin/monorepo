import miniframe from './miniframe'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import icons from './ui/icons'
import pages from './ui/pages'
import './array-repeat'
import './elements/toasts'
import './elements/toast'
globalThis.isApiReady = () => new Promise((resolve, reject) => {
  if (globalThis.api && globalThis.api.ready) resolve();
  pubsub.subscribe('api.ready', () => {
    resolve()
  })
});

export default customElements.define('lottery-shell', class LotteryShell extends BaseClass {
  get _pages() {
    return this.sqs('custom-pages')
  }
  constructor() {
    super()
    this._onhashchange = this._onhashchange.bind(this)
  }

  connectedCallback() {
    this.setTheme('default')
    globalThis.onhashchange = this._onhashchange;
    this._onhashchange()
  }

  needsAPI(view) {
    if (view === 'home' || view === 'connect' || view === 'history' || view === 'tickets' || view === 'buy' || view === 'results') {
      return true
    }
    return false
  }

  _onhashchange() {
    let selected = globalThis.location.hash
    selected = selected.split('#!/')
    this._select(selected[1] ? selected[1] : selected[0])
  }

  async _select(selected) {
    selected = selected.split('?')
    const params = selected[1] ? selected[1].split('=')[1] : undefined
    selected = selected[0]
    if (!selected) selected = 'home'
    !await customElements.get(`${selected}-view`) && await import(`./${selected}.js`)
    this._previousSelected = this._pages.selected
    this._pages.select(selected)
    if (selected === 'connect') {
      await this.shadowRoot.querySelector('connect-view').connect()
      this._pages.select(this._previousSelected)
    }
    if (this.needsAPI(selected) && !globalThis.api) {
      const importee = await import('./api.js')
      globalThis.api = new importee.default()
    }
    if (params) {
      const el = this.shadowRoot.querySelector(`${selected}-view`)
      el.load(params)
    }

  }

  async setTheme(theme) {
    const importee = await import(`./themes/${theme}.js`)
    for (const prop of Object.keys(importee.default)) {
      document.querySelector('body').style.setProperty(`--${prop}`, importee.default[prop])
    }
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

  .logo {
    height: 32px;
    width: 32px;
    padding: 12px;
    pointer-events: auto;
  }

  a {
    display: flex;
    align-items: center;
    pointer-events: auto;
    padding: 12px;
    box-sizing: border-box;
    text-decoration: none;
    color: #111;
    text-transform: uppercase;
  }
</style>
${icons}
<flex-row center>
  <custom-svg-icon icon="menu"></custom-svg-icon>
  <flex-one></flex-one>
  <a title="lottery results" href="#!/results">results</a>
  <a title="ticket history" href="#!/history">history</a>
  <a title="home" href="#!/home"><img class="logo" src="https://assets.artonline.site/arteon.svg"></img></a>
</flex-row>
${pages}
<custom-toasts></custom-toasts>
    `
  }
})

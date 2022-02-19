import miniframe from './miniframe'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import icons from './ui/icons'
import pages from './ui/pages'
import './array-repeat'

export default customElements.define('lottery-shell', class LotteryShell extends BaseClass {
  get _pages() {
    return this.sqs('custom-pages')
  }
  constructor() {
    super()
  }

  connectedCallback() {
    this.setTheme('default')
    this._select('home')
  }

  async _select(selected) {
    !await customElements.get(`${selected}-view`) && await import(`./${selected}.js`)
    this._previousSelected = this._pages.selected
    this._pages.select(selected)
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
  }
</style>
${icons}
<flex-row center>
  <custom-svg-icon icon="menu"></custom-svg-icon>
  <flex-one></flex-one>
  <img class="logo" src="https://assets.artonline.site/arteon.svg"></img>
</flex-row>
${pages}
    `
  }
})

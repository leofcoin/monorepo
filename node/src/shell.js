import miniframe from './miniframe'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import icons from './ui/icons'
import pages from './ui/pages'
import './../node_modules/@leofcoin/peernet/dist/browser/peernet'

export default customElements.define('node-shell', class NodeShell extends BaseClass {
  get _pages() {
    return this.sqs('custom-pages')
  }
  // #privateField2
  constructor() {
    super()
    this._init()
    // this.#privateField2 = 1
    // console.log(this.#privateField2);
    // this.#privateField2 = 2
    // console.log(this.#privateField2);
  }

  async _init() {
    await new Peernet({network: 'leofcoin:olivia', root: '.artonline', networkName: 'leofcoin:olivia', networkVersion: 'v0.1.0'})
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

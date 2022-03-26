import miniframe from './miniframe'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import icons from './ui/icons'
import pages from './ui/pages'
import './../node_modules/@leofcoin/peernet/dist/browser/peernet'

const COLORS = [
  '#e21400', '#91580f', '#f8a700', '#f78b00',
  '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
  '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
];



globalThis.authorShadow = author => {
  author = this.authorColor(author);
  return [`${author}24`, `${author}1f`, author]
}

globalThis.authorColor = author => {
  // Compute hash code
  let hash = 7;
  for (let i = 0; i < author.length; i++) {
   hash = author.charCodeAt(i) + (hash << 5) - hash;
  }
  // Calculate color
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
}

export default customElements.define('node-shell', class NodeShell extends BaseClass {
  get _pages() {
    return this.sqs('custom-pages')
  }

  constructor() {
    super()
    this._init()
  }

  async _init() {
    await new Peernet({network: 'leofcoin:olivia', root: '.artonline', networkName: 'leofcoin:olivia', networkVersion: 'v0.1.0'})
    this._select('home')
  }

  connectedCallback() {
    this.setTheme('default')
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

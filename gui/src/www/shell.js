import Pubsub from './../../node_modules/@vandeurenglenn/little-pubsub/src/index'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import './../../node_modules/custom-pages/src/custom-pages'
import './../../node_modules/custom-selector/src/index'
import './../../node_modules/custom-svg-iconset/src/custom-svg-iconset'
import './../../node_modules/custom-svg-icon/src/custom-svg-icon'
import './array-repeat'

import './clipboard-copy.js'
import icons from './icons'

globalThis.pubsub = globalThis.pubsub || new Pubsub({verbose: true})

export default customElements.define('app-shell', class AppShell extends HTMLElement {

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  get #pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  async #select(selected) {
    if (!customElements.get(`${selected}-view`)) await import(`./${selected}.js`)
    this.#pages.select(selected)
    const monacoContainer = document.querySelector('.container')
    if (selected === 'editor') monacoContainer.classList.add('custom-selected')
    else monacoContainer.classList.remove('custom-selected')
  }

  async #onhashchange() {
    const selected = location.hash.split('/')[1]
    selected && this.#select(selected)
  }

  async init() {
    

    // pubsub.subscribe('chain:ready', this.apiReady.bind(this))
    // const imp = await import('./api.js')

    // globalThis.api = globalThis.api || imp.default
    if (this.hasAttribute('api-ready')) {
      this.apiReady()
    } else {
      setTimeout(() => {
        return this.init()
      }, 100)
    }
  }

  async apiReady() {
    onhashchange = this.#onhashchange.bind(this)
    if (location.hash.split('/')[1]) this.#select(location.hash.split('/')[1])
    else this.#select('wallet')
  }

  connectedCallback() {
    this.peersConnected = 0
    this.init()
  }

  get template() {
    return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100;0,300;0,400;0,600;0,700;0,800;1,300;1,400&display=swap');

      :host {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        font-family: 'Noto Sans', sans-serif;
        background: linear-gradient(45deg, #66477c, transparent);
      }

      .main {
        height: -webkit-fill-available;
      }

      custom-selector {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .custom-selector-overlay {
        background: #ffffff8c;
        --svg-icon-color: #66477c;
        border-right: 1px solid #eee;
      }

      a {
        padding: 12px;
        box-sizing: border-box;
        height: 48px;
      }
      ::slotted(.container) {
        display:flex;
        flex-direction:column;
        width:100%;
        height: 100%;
      }
    </style>
    ${icons}
    <flex-row class="main">
      <span class="custom-selector-overlay">
        <custom-selector attr-for-selected="data-route">
          <a href="#!/wallet" data-route="wallet">
            <custom-svg-icon icon="wallet"></custom-svg-icon>
          </a>
          <a href="#!/validator" data-route="validator">
            <custom-svg-icon icon="gavel"></custom-svg-icon>
          </a>
          <a href="#!/editor" data-route="editor">
            <custom-svg-icon icon="mode-edit"></custom-svg-icon>
          </a>
          <a href="#!/stats" data-route="stats">
            <custom-svg-icon icon="stats"></custom-svg-icon>
          </a>
        </custom-selector>
      </span>

        <custom-pages attr-for-selected="data-route">
          <wallet-view data-route="wallet"></wallet-view>
          <validator-view data-route="validator"></validator-view>
          <editor-view data-route="editor"><slot></slot></editor-view>
          <stats-view data-route="stats"></stats-view>
          
        </custom-pages>



    </flex-row>


    `
  }
})

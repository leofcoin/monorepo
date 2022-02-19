import './../../node_modules/custom-tabs/custom-tabs'
import './../../node_modules/custom-tabs/custom-tab'

export default customElements.define('products-view', class extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._onSelected = this._onSelected.bind(this)
  }

  get tabs() {
    return this.shadowRoot.querySelector('custom-tabs')
  }

  get pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  connectedCallback() {
    this.tabs.addEventListener('selected', this._onSelected)
    this.tabs.select('platform')
    this._onSelected()
  }

  async _onSelected() {
    const selected = this.tabs.selected
    await !customElements.get(`${selected}-view`) && await import(`./${selected}.js`)

    this.pages.select(selected)
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
        justify-content: center;
        align-items: center;
        color: var(--primary-text-color);
        font-weight: 400;
        background: black;
      }

      .container {
        display: flex;
        justify-content: center;
        height: 512px;
        width: 1280px;
        box-sizing: border-box;
        padding: 21px;
        color: var(--primary-text-color);
      }

      .content {
        height: 100%;
        width: 100%;
      }
      .content > span {

      }
      .flex {
        flex: 1;
      }

      .flex2 {
        flex: 2;
      }

      h2 {
        font-size: 81px;
        padding-left: 81px;
      }

      header {
        display: flex;
        justify-content: center;
        width: 100%;
        background-color: #333;
        color: var(--secondary-accent-color);
        box-shadow: 0 1px 18px 0px rgb(0 0 0 / 42%);
        z-index: 201;
      }
      custom-tab {
        width: 100%;
        pointer-events: auto;
        font-weight: 400;
        user-select: none;
      }
      custom-tab.custom-selected, custom-tab.custom-selected:hover {
        color: var(--main-accent-color);
        border: none;
        font-size: 22px;
        font-weight: 700;
      }

      custom-tab:hover {
        color: var(--hover-accent-color);
      }

      custom-tabs {
        width: 50%;
        text-align: center;
      }

      .content {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      .wrp-space {
        display: flex;
      }

      @media (max-width: 600px) {
        custom-tabs {
          width: 100%;
        }
      }
    </style>
    <span class="content">
      <span class="wrp-space">
        <span class="flex"></span>
        <header>
          <custom-tabs attr-for-selected="data-route">
            <custom-tab data-route="platform"><span>Platform</span></custom-tab>
            <custom-tab data-route="exchange"><span>Exchange</span></custom-tab>
            <custom-tab data-route="lottery"><span>Lottery</span></custom-tab>
            <custom-tab data-route="faucet"><span>Faucet</span></custom-tab>
          </custom-tabs>
        </header>
        <span class="flex"></span>
      </span>
      <custom-pages attr-for-selected="data-route">
        <platform-view data-route="platform"></platform-view>
        <lottery-view data-route="lottery"></lottery-view>
        <exchange-view data-route="exchange"></exchange-view>
        <faucet-view data-route="faucet"></faucet-view>
      </custom-pages>
    </span>

    `
  }
})

import './token-select'
import { input, elevation2dp } from './../styles/shared'

let timeout;

export default customElements.define('swap-coin', class SwapCoin extends HTMLElement {
  static get inputStyle() {
    return input
  }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    console.log(input);
    this.shadowRoot.innerHTML = this.template

    this._onSelected = this._onSelected.bind(this)
    this._oninput = this._oninput.bind(this)
  }

  get amount() {
    return this.input.value
  }

  get img() {
    return this.shadowRoot.querySelector('img')
  }

  get select() {
    return this.shadowRoot.querySelector('token-select')
  }

  get input() {
    return this.shadowRoot.querySelector('input[type="text"]')
  }

  get balance() {
    return this.shadowRoot.querySelector('swap-balance')
  }

  get event() {
    return this.getAttribute('event')
  }

  get type() {
    return this.event.split('.')[1]
  }

  connectedCallback() {
    if (this.type === 'sell') {
      this.shadowRoot.innerHTML = this.template
      this.input.setAttribute('placeholder', 'Enter Amount')
      this.input.addEventListener('input', this._oninput)
    }
    // this.select.addEventListener('selected', this._onSelected)

    this.select.addEventListener('custom-select', this._onSelected)
  }

  set selected(value) {
    this.select.select(value)
  }

  async _onSelected() {
    this.symbol = this.select.selected
    console.log(this.symbol);
    const theme = css.theme ? 'dark' : 'color'
    const img = globalThis.css.lists[globalThis.css.lists.selected][this.symbol].icon[theme]


    const el = document.createElement('flex-row')
    el.style = 'align-items: center';
    el.innerHTML = `<img style="height: 24px; padding-right: 6px;" src="${img}"></img>${this.symbol}`
    this.select.shadowRoot.querySelector('.selected').innerHTML = el.outerHTML

    if (this.type === 'sell') {
      pubsub.publish(`${this.event}.coin`, this.symbol)
    } else if (this.type === 'buy') {
      pubsub.publish(this.event, this.symbol)
    }

    this.balance.balance = await api.balanceOf(this.symbol, api.signer.address)
    this.balance.symbol = this.symbol
  }

  _oninput() {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (this.amount && this.type === 'sell') {
        pubsub.publish(`${this.event}.amount`, this.amount)
      }
    }, 500);

  }

  get tokens() {
    return this.shadowRoot.querySelector('token-select')
  }

  get template() {
    return `
    <style>
      :host {
        flex-direction: column;
        display: flex;
        padding: 14px 20px;
        box-sizing: border-box;
        background: var(--main-input-background);
        width: 100%;
        height: 100%;
        max-height: 90px;
        border-radius: 20px;
        color: #333;

        --svg-icon-color: #333;
        ${elevation2dp}
      }

      ${input}

      input {
        font-weight: 400;
        font-size: 20px;
      }
      input, custom-select {
        color: #333;
      }

      custom-select {
        font-weight: 600;
      }

      :host([buy]) input {
        pointer-events: none;
      }

      img {
        height: 24px;
        padding-right: 16px;
      }

      .search {
        display: flex;
        padding: 12px;
        box-sizing: border-box;
        justify-content: center;
        pointer-events: none;
      }

      .search input {
        pointer-events: none;
      }

      button {
        background: var(--main-button-background);
        color: var(--main-button-color);
        border-radius: 12px;
        border: none;
        height: 24px;
      }
      flex-row {
        align-items: center;
        padding: 0 0 12px 0;
      }
      custom-select[opened] .search input {
        pointer-events: auto !important;
      }
    </style>

    <flex-row>
      <swap-balance balance="0"></swap-balance>
      <flex-one></flex-one>
      <token-select></token-select>
    </flex-row>
    <flex-row>
      <input placeholder="0" type="text"></input>
      ${this.type === 'sell' ? `<flex-one></flex-one><button>max</button>` : ''}
    </flex-row>
    `
  }
})

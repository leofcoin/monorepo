import './../../node_modules/@vandeurenglenn/custom-select/custom-select'
import './gpu-img'
import { rotate, rotateBack } from './../styles/shared'
export default customElements.define('gpu-select', class GpuSelect extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this._selected = this._selected.bind(this)
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        flex-row {
          width: 100%;
          align-items: center;
          box-sizing: border-box;
          padding: 12px;
        }

        span {
          display: flex;
          box-sizing: border-box;
          padding: 3px 6px;
        }


        ${rotate}
        ${rotateBack}
      </style>
      <gpu-img></gpu-img>
      <flex-row>
        <strong>GPU</strong>
        <flex-one></flex-one>
        <custom-select class="gpu"></custom-select>
      </flex-row>
    `
  }

  get _select() {
    return this.shadowRoot.querySelector('custom-select')
  }

  get selected() {
    return this._select.selected
  }

  set selected(value) {
    this._select.selected = value
  }

  connectedCallback() {
    this._init()
    this._select.addEventListener('selected', this._selected)
  }

  async _selected({detail}) {
    this.shadowRoot.querySelector('gpu-img').symbol = detail
    this.dispatchEvent(new CustomEvent('selected', { detail }))
  }

  async _init() {
    let i = 0
    const pools = await api.pools()
    const names = await api.poolNames()
    for (let i = 0; i < pools.length; i++) {
      const el = document.createElement('span')
      console.log(names[i]);
      el.innerHTML = names[i][1]
      el.dataset.index = pools[i]
      el.dataset.route = names[i][1]
      this._select.appendChild(el)
    }

    this.shadowRoot.querySelector('gpu-img').symbol = 'GENESIS'
    this.selected = 'GENESIS'
  }
})

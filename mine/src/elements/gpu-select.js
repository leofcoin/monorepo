import './../../node_modules/@vandeurenglenn/custom-select/custom-select'

export default customElements.define('gpu-select', class GpuSelect extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
      </style>

      <custom-select class="gpu"></custom-select>
    `
  }

  get _select() {
    return this.shadowRoot.querySelector('custom-select')
  }

  get cards() {
    return api.cards;
  }

  connectedCallback() {
    this._init()
  }

  async _init() {
    let i = 0
    for (const key of this.cards) {
      console.log({key});
      const el = document.createElement('span')
      el.innerHTML = key
      el.dataset.index = i
      el.dataset.route = key
      this._select.appendChild(el)
      i++
    }
    this._select.selected = 'GENESIS'
  }
})

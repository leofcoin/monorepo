export default customElements.define('token-select', class TokenSelect extends HTMLElement {
  get list() {
    return globalThis.css.tokenList
  }
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._onclick = this._onclick.bind(this)
  }

  connectedCallback() {
    this.addEventListener('click', this._onclick)
  }

  select(symbol) {
    this.selected = symbol
    this.dispatchEvent(new CustomEvent('custom-select', {detail: api.tokenInfo(symbol)}))
  }

  async _onclick(event) {
    console.log(event);
    const target = event.composedPath()[0]
    const {top, left, right} = target.getBoundingClientRect()

    const selected = document.querySelector('swap-shell').selected
    await document.querySelector('swap-shell').select('token-list')
    const result = await this.list.show({top, left, right})
    await document.querySelector('swap-shell').select(selected)
    console.log({result});

    this.selected = result.symbol
    this.dispatchEvent(new CustomEvent('custom-select', {detail: result}))
  }

  get template() {
    return `
      <style>
        * {
          pointer-events: none;
        }
        :host {
          display: flex;
          pointer-events: auto;
          cursor: pointer;
        }
      </style>
      <span class="selected" icon></span>
      <custom-svg-icon icon="expand-more"></custom-svg-icon>
    `
  }
})

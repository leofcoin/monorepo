export default customElements.define('search-element', class SearchElement extends BaseClass {
  constructor() {
    super()

    this._onInput = this._onInput.bind(this)
  }

  get _input() {
    return this.sqs('input')
  }

  connectedCallback() {
    this._input.addEventListener('input', this._onInput)
  }

  _onInput() {
    this._timeout && clearTimeout(this._timeout)

    this._timeout = () => setTimeout(() => {
      document.dispatchEvent(new CustomEvent('custom-search', {
        detail: this._input.value
      }))
    }, 200);

    this._timeout()
  }

  get template() {
    return html`
    <style>
      :host {
        display: flex;
        height: 44px;
        width: 100%;
        max-width: 480px;
        padding: 8px 12px;
        box-sizing: border-box;
        border: 1px solid #888;
        border-radius: 12px;
        pointer-events: auto;
        margin: 0 24px;
        --svg-icon-color: var(--main-color);
      }

      input {
        height: 100%;
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        color: var(--main-color);
      }
      input[type="search"]::-webkit-search-decoration,
      input[type="search"]::-webkit-search-cancel-button,
      input[type="search"]::-webkit-search-results-button,
      input[type="search"]::-webkit-search-results-decoration {
        -webkit-appearance:none;
      }
    </style>
    <custom-svg-icon icon="search"></custom-svg-icon>
    <input type="search" placeholder="search"></input>
    <custom-svg-icon icon="clear"></custom-svg-icon>
    `
  }
})

export default customElements.define('search-element', class SearchElement extends BaseClass {
  constructor() {
    super()
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
      }

      input {
        height: 100%;
        width: 100%;
        border: none;

      }
    </style>
    <custom-svg-icon icon="search"></custom-svg-icon>
    <input type="search" placeholder="search"></input>
    <custom-svg-icon icon="clear"></custom-svg-icon>
    `
  }
})

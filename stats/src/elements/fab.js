export default customElements.define('fab-element', class FabElement extends BaseClass {
  constructor() {
    super()
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
        height: 40px;
        width: 100%;
        max-width: 96px;
        padding: 8px 12px;
        box-sizing: border-box;
        border: 1px solid #888;
        border-radius: 12px;
        position: absolute;
        bottom: 24px;
        right: 24px;
        pointer-events: auto;
        cursor: pointer;
      }
      strong {
        padding-left: 8px;
      }
    </style>
    <custom-svg-icon icon="add"></custom-svg-icon>
    <strong>List</strong>
    `
  }
})

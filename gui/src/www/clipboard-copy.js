export default customElements.define('clipboard-copy', class ClipboardCopy extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.title = 'click to copy'
    this.shadowRoot.innerHTML = this.template
  }

  copy() {
    navigator.clipboard.writeText(this.innerHTML);
  }

  connectedCallback() {
    this.addEventListener('click', this.copy.bind(this))
  }

  get template() {
    return `
<style>
  :host {
    display: flex;
    padding: 6px 12px;
    box-sizing: border-box;
    pointer-events: auto !important;
    cursor: pointer;
    font-size: 14px;
  }
</style>
<slot></slot>
    `
  }

})

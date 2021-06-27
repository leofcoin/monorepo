export default customElements.define('arteon-button', class ArteonButton extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }
  get template() {
    return `
    <style>
      :host {
        display: flex;
        height: 40px;
        min-width: 86px;
      }
      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
        height: inherit;
        min-width: inherit;
      }
    </style>
    <button><slot></slot></button>
      `
  }
})

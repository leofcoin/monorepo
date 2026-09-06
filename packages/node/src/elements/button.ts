import { css, html, LitElement } from "lit";

export default customElements.define('button-element', class ButtonElement extends LitElement {
  constructor() {
    super()
  }

  static get styles() {
    return css`
      :host {
        display: contents;
      }
      button {
        cursor: pointer;
        background: transparent;
        border-radius: 12px;
        box-sizing: border-box;
        padding: 6px 12px;
        pointer-events: auto;
      }
    `
  }

  render() {
    return html`
      <button>
        <slot></slot>
      </button>
    `
  }
})
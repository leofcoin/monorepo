import {html, css, LitElement} from 'lit'
export default customElements.define('property-info', class PropertyInfo extends LitElement {

  constructor() {
    super()
  }

  static styles = css`
  :host {
    display: flex;
    padding: 6px 12px;
    box-sizing: border-box;
    width: 100%;
  }
  .container {
    padding: 6px 12px;
    box-sizing: border-box;
    background: var(--secondary-background);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    align-items: center;
    width: 100%;
    color: var(--font-color);
  }
  `

  render() {
    return html`
    <flex-row class="container">
      <slot></slot>
    </flex-row>
    `
  }

});
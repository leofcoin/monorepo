import { html, LitElement } from "lit";
import { map } from "lit/directives/map.js";
import '../clipboard-copy.js'

export default customElements.define('dropdown-element', class DropdownElement extends LitElement {
  static properties = {
    selected: {
      type: String
    },
    items: {
      type: Array
    }
  }

  constructor() {
    super()
  }

  render() {
    return html`
    ${map(this.items, item => html`
    <flex-row>
      <strong>${item[0]}</strong>
      <flex-one></flex-one>
      <shorten-string value=${item[1]}></shorten-string>
    </flex-row>
    `)}
    `
  }
})
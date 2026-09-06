import {html, css, LitElement} from 'lit'
export default customElements.define('param-element', class ParamElement extends LitElement {
  static properties = {
    value: {
      type: String
    }
  }

  set value(value) {
    if (value.includes('YT')) this.type = 'address'
    if (value.includes('IH')) this.type = 'contract'
  }

  constructor() {
    super()
  }

  static styles = css``

  render(){
    return html``
  }
});
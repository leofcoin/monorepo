export default customElements.define('account-element', class AccountElement extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'internal', 'external']
  }

  attributeChangedCallback(name, old, value) {
    if (old !== value) this[name] = value
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  set name(value) {
    this.shadowRoot.querySelector('.name').innerHTML = value
  }

  set internal(value) {
    this._internal = value
  }

  set external(value) {
    this._external = value
    this.run(value)

  }

  async run(value) {
    this.shadowRoot.querySelector('.address').innerHTML = `${value.slice(0, 6)}...${value.slice(-6)}`
    this.shadowRoot.querySelector('.balance').innerHTML = await api.balanceOf(value)
  }

  // set external(value) {
  //   this.shadowRoot.querySelector('.address').innerHTML = `${value.slice(0, 6)}...${value.slice(-6)}`
  // }

  get template() {
    return `
<style>
  * {
    pointer-events: none;
  }
  :host {
    display: flex;
    flex-direction: column;
    padding: 12px;
    box-sizing: border-box;
    cursor: pointer;
    pointer-events: auto !important;
  }
  .name {
    padding-bottom: 6px;
  }
</style>
<flex-row>
  <span class="name"></span>
  <flex-one></flex-one>
  <span class="balance"></span>
</flex-row>
<flex-one></flex-one>
<span class="address"></span>
    `
  }

})

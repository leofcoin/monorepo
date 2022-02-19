import './highlight'

export default customElements.define('contract-maker', class ContractMaker extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._onselect = this._onselect.bind(this)
    this._onfeature = this._onfeature.bind(this)
  }

  get _tabs() {
    return this.shadowRoot.querySelector('custom-tabs')
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-tabs')
  }

  connectedCallback() {
    this._tabs.addEventListener('custom-select', this._onselect)
    this._selector.addEventListener('custom-select', this._onselect)
  }

  _onselect() {
    const features = 
    const code = codes[this._tabs.selected][]
    this.shadowRoot.querySelector('highlight-element').render(code)
  }

  _onfeature() {

  }


  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
      }
    </syle>
    <custom-tabs>
      <custom-tab>ERC721</custom-tab>
      <custom-tab>ERC1155</custom-tab>
    </custom-tabs>
    <flex-row>
      <span>features</span>
      <custom-selector>
        <contract-feature></contract-feature>
      </custom-selector>
      <highlight-element></highlight-element>
    </flex-row>`
  }
})

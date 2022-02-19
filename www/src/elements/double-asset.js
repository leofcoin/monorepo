
import './eyedrop'

export default customElements.define('double-asset-element', class DoubleAssetElement extends HTMLElement {
  static get observedAttributes() {
    return ['src']
  }
  attributeChangedCallback(name, old, value) {
    if (old !== value) this[name] = value
  }

  set src(value) {
    this.shadowRoot.querySelector('img').src = value
  }
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: relative;
          display: flex;
          flex-direction: column;
          max-width: 438px;
          max-height: 496px;
        }
        eyedrop-element {
          width: 100%;
          width: -webkit-fill-available;
        }

        img {
          z-index: 1;
          width: 80%;
        }
      </style>
      <eyedrop-element></eyedrop-element>
      <img></img>
    `
  }
})

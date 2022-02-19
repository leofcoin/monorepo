export default customElements.define('eyedrop-element', class EyedropElement extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          max-width: 700px;
          max-height: 496px;
        }
        [icon="eyedrop::1"], [icon="eyedrop::2"], [icon="eyedrop::3"] {
          width: inherit;
          height: inherit;
          position: absolute;
        }
      </style>
      <custom-svg-icon icon="eyedrop::3"></custom-svg-icon>
      <custom-svg-icon icon="eyedrop::2"></custom-svg-icon>
      <custom-svg-icon icon="eyedrop::1"></custom-svg-icon>
    `
  }
})

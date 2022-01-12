export default customElements.define('claim-stake', class ClaimStake extends HTMLElement {

  static get observedAttributes() {
    return ['claimed', 'claimable', 'release']
  }
  attributeChangedCallback(name, old, value) {
    if (old !== value) this[name] = value
  }

  get _button() {
    return this.shadowRoot.querySelector('button')
  }

  set claimable(value) {
    if (value === 'true') this._button.innerHTML = 'claim'
  }

  set claimed(value) {
    this.style.pointerEvents = 'none'
    if (value === 'true') this._button.innerHTML = 'claimed'
  }

  set release(value) {
    if (value !== '0') this._button.innerHTML = new Date(Number(value) * 1000).toLocaleString()
  }

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
        cursor: pointer;
        pointer-events: auto;
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
        pointer-events: none;
        min-width: inherit;
      }
    </style>
    <button></button>
      `
  }
})

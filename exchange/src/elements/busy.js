import './../animations/busy'

export default customElements.define('busy-element', class BusyElement extends BaseClass {
  constructor() {
    super()
  }

  show(text) {
    this.innerHTML = text
    this.setAttribute('shown', '')
  }

  hide() {
    this.removeAttribute('shown', '')
  }

  done() {
    this.removeAttribute('shown', '')
  }

  get template() {
    return html`
<style>
  * {
    pointer-events: none;
    user-select: none;
  }
  :host {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: var(--header-height);
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--main-background-color);
    z-index: 1000;
    opacity: 0;
  }
  :host([shown]) {
    opacity: 1;
  }
</style>

<busy-animation></busy-animation>
<slot></slot>
    `
  }
})

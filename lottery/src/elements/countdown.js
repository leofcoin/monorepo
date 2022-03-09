export default customElements.define('custom-countdown', class CustomCountdown extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  set value(value) {
    const currentTime = Math.round(new Date().getTime() / 1000)
    value = value - currentTime
    const hours = Math.floor((value % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((value % (60 * 60)) / (60));

    if (hours !== 0) {
      value = `${hours} ${hours > 1 ? 'hours' : 'hour'} ${minutes} ${minutes > 1 ? 'minutes' : 'minute'}`
    } else {
      value = `${minutes} ${minutes > 1 ? 'minutes' : 'minute'}`
    }
    this.innerHTML = value
  }

  get template() {
    return html`
      <style></style>
      <slot></slot>
    `
  }
})

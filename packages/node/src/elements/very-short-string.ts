import { css, html, LitElement } from "lit"

export default customElements.define('very-short-string', class VeryShortString extends LitElement {
  #value;

  static properties = {
    shorted: {
      type: String
    },
    value: {
      type: String,
      reflect: true
    },
    shortenBy: {
      type: Number
    }
  }

  static styles = css`
  :host {
    cursor: pointer
  }
  `

  constructor() {
    super()
    this.title = 'click to copy'
    this.shortenBy = 10
  }

  copy() {
    navigator.clipboard.writeText(this.#value || this.innerHTML);
    const innerHTML = this.innerHTML
    this.innerHTML = 'copied!'

    setTimeout(() => this.innerHTML = innerHTML, 750)
  }

  connectedCallback() {
    super.connectedCallback && super.connectedCallback()
    this.addEventListener('click', this.copy.bind(this))
  }

  set value(value) {
    this.#value = value
    this.shorted = `...${value.slice(-this.shortenBy)}`
  }


  render() {
    return html`
    <span>${this.shorted}</span>
    `
  }


})
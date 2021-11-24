class BaseClass extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    if (this.template) this.shadowRoot.innerHTML = this.template
  }

  sqs(query) {
    return this.shadowRoot.querySelector(query)
  }

  qs(query) {
    return this.querySelector(query)
  }
}

export default BaseClass

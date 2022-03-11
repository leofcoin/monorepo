import './ticket-number'

export default customElements.define('ticket-element', class TicketElement extends BaseClass {
  static get observedAttributes() {
    return ['numbers', 'edit']
  }
  constructor() {
    super()
  }

  attributeChangedCallback(name, old, value) {
    if (this.old !== value) this[name] = value
  }

  set numbers(value) {
    console.log(value);
    this.first = value.charAt(0)
    this.second = value.charAt(1)
    this.third = value.charAt(2)
    this.fourth = value.charAt(3)
    this.fifth = value.charAt(4)
    this.sixth = value.charAt(5)
  }

  set edit(value) {
    if (value === 'true') Array.from(this.shadowRoot.querySelectorAll('ticket-number')).forEach((item, i) => {
      item.setAttribute('edit', 'true')
    });

  }

  get numbers() {
    const inputs = Array.from(this.shadowRoot.querySelectorAll('ticket-number'))

    return inputs.map(i => i.value)
  }

  set first(value) {
    this.shadowRoot.querySelector('[data-input="0"]').value = value
  }

  set second(value) {
    this.shadowRoot.querySelector('[data-input="1"]').value = value
  }

  set third(value) {
    this.shadowRoot.querySelector('[data-input="2"]').value = value
  }

  set fourth(value) {
    this.shadowRoot.querySelector('[data-input="3"]').value = value
  }

  set fifth(value) {
    this.shadowRoot.querySelector('[data-input="4"]').value = value
  }

  set sixth(value) {
    this.shadowRoot.querySelector('[data-input="5"]').value = value
  }

  get template() {
    return html`
    <style>
      * {
        user-select: none;
        pointer-events: none;
      }
      :host {
        display: flex;
        /* width: 198px; */
        padding: 8px 12px;
        box-sizing: border-box;
        /* border: 1px solid #888; */
        border-radius: 24px;
        pointer-events: auto;
        cursor: pointer;
        margin-bottom: 6px;
      }
    </style>
    <ticket-number edit="false" data-input="0" max="9" type="number"></ticket-number>

    <ticket-number edit="false" data-input="1" max="9" type="number"></ticket-number>

    <ticket-number edit="false" data-input="2" max="9" type="number"></ticket-number>

    <ticket-number edit="false" data-input="3" max="9" type="number"></ticket-number>

    <ticket-number edit="false" data-input="4" max="9" type="number"></ticket-number>

    <ticket-number edit="false" data-input="5" max="9" type="number"></ticket-number>

    `
  }
})

export default customElements.define('ticket-element', class TicketElement extends BaseClass {
  static get observedAttributes() {
    return ['numbers']
  }
  constructor() {
    super()
    this._onInput = this._onInput.bind(this)
  }

  connectedCallback() {
    const inputs = Array.from(this.shadowRoot.querySelectorAll('input'))
    inputs.forEach((input, i) => {
      input.addEventListener('input', this._onInput)
    });

  }

  attributeChangedCallback(name, old, value) {
    if (this.old !== value) this[name] = value
  }

  _onInput() {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      const inputs = Array.from(this.shadowRoot.querySelectorAll('input'))
      inputs.forEach((input, i) => {
        if (Number(input.value) > Number(input.getAttribute('max'))) input.value = Number(input.getAttribute('max'))
      });
    }, 200);
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

  get numbers() {
    const inputs = Array.from(this.shadowRoot.querySelectorAll('input'))

    return inputs.map(i => i.value)
  }

  set first(value) {
    this.shadowRoot.querySelector('input[data-input="0"]').value = value
  }

  set second(value) {
    this.shadowRoot.querySelector('input[data-input="1"]').value = value
  }

  set third(value) {
    this.shadowRoot.querySelector('input[data-input="2"]').value = value
  }

  set fourth(value) {
    this.shadowRoot.querySelector('input[data-input="3"]').value = value
  }

  set fifth(value) {
    this.shadowRoot.querySelector('input[data-input="4"]').value = value
  }

  set sixth(value) {
    this.shadowRoot.querySelector('input[data-input="5"]').value = value
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
        height: 40px;
        width: 198px;
        padding: 8px 12px;
        box-sizing: border-box;
        border: 1px solid #888;
        border-radius: 12px;
        pointer-events: auto;
        cursor: pointer;
      }
      input {
        pointer-events: auto;
        background: transparent;
        border: none;
        width: 22px;
        -appearance: none;
        -webkit-appearance: none;
        text-align: end;
        outline: none;
      }
      input::-webkit-inner-spin-button {
        -appearance: none;
        -webkit-appearance: none;
      }
      :host([edit="false"]) input {
        pointer-events: none;
      }
    </style>
    <input data-input="0" max="9" type="number"></input>
    <input data-input="1" max="9" type="number"></input>
    <input data-input="2" max="9" type="number"></input>
    <input data-input="3" max="9" type="number"></input>
    <input data-input="4" max="9" type="number"></input>
    <input data-input="5" max="9" type="number"></input>
    `
  }
})

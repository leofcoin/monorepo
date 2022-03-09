const COLORS = {
  0: '#f8a700',
  1: '#8857e9',
  2: '#287b00',
  3: '#60bf24',
  4: '#cf25c2',
  5: '#3b88eb',
  6: '#573e6a',
  7: '#a700ff',
  8: '#d300e7',
  9: '#24a6ad'
}

export default customElements.define('ticket-number', class TicketNumber extends BaseClass {

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

  _onInput() {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      const input = this.shadowRoot.querySelector('input')
      if (Number(input.value) > Number(input.getAttribute('max'))) input.value = Number(input.getAttribute('max'))

    }, 200);
  }

  colorFor(number) {
    return COLORS[number];
  }

  set value(value) {
    this.shadowRoot.querySelector('input').value = value
    this.style.background = this.colorFor(value)
  }

  get value() {
    return this.shadowRoot.querySelector('input').value
  }

  get template() {
    return html`
    <style>
      * {
        user-select: none;
        pointer-events: none;
      }
      :host {
        color: #eee;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        margin: 0 4px;
      }
      input {
        pointer-events: auto;
        background: transparent;
        border: none;
        width: 22px;
        height: 22px;
        -appearance: none;
        -webkit-appearance: none;
        text-align: center;
        outline: none;
        color: #eee;
      }
      input::-webkit-inner-spin-button {
        -appearance: none;
        -webkit-appearance: none;
      }
      :host([edit="false"]) input {
        pointer-events: none;
      }
    </style>
    <input max="9" type="number"></input>
    `
  }
})

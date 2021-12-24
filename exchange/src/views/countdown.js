export default customElements.define('countdown-view', class CountdownView extends BaseClass {
  static get observedAttributes() {
    return ['value']
  }
  constructor() {
    super()
  }

  attributeChangedCallback(name, old, value) {
    this[name] = value
  }

  get _min() {
    return 60000
  }

  get _hour() {
    return 60 * 24
  }

  get _day() {
    return 24
  }

  set value(ms) {
    ms = Number(ms)
    if (ms > this._min) {
      this.min = Math.round(ms / 60000)

      if (this.min > this._hour) {
        console.log(this.min);
        const result = String(this.min / 60).split('.')
        this.hours = result[0]
        this.min = result[1]
      }
      if (this.hours > this._day) {
        const result = String(this.hours / 24).split('.')
        this.days = result[0]
        this.hours = result[1]
      }
    }

    let runs = 0
    this.sec = 59
    this.min -= 1

    const timeout = () => setTimeout(() => {
      if (runs === 60) {
        this.min -= 1
        runs = 0
      }
      runs +=1
      this.sec -= 1
      this.shadowRoot.innerHTML = this.template
      if (this.days !== 0 || this.hours !== 0 || this.sec !== 0 || this.min !== 0 ) timeout()
    }, 1000);

    timeout()
    this.shadowRoot.innerHTML = this.template
  }

  get template() {
    return html`
    <style>
      :host {
        width: 100%;
        height: 100%;
        color: var(--main-color);
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
<flex-row>
  ${this.days > 0 ? `<span class="days">${this.days} :</span>`: ''}
  ${this.hours > 0 ? `<span class="hours">${this.hours} :</span>`: ''}
  ${this.min > 0 ? `<span class="min">${this.min} : </span>`: ''}
  ${this.sec > 0 ? `<span class="sec"> ${this.sec}</span>`: ''}
</flex-row>
    `
  }
})

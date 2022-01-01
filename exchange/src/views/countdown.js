import './../animations/loading'

export default customElements.define('countdown-view', class CountdownView extends BaseClass {
  static get observedAttributes() {
    return ['value']
  }
  constructor() {
    super()


  }

  connectedCallback() {
    if (this.hasAttribute('value')) return;
    (async () => {
      const response = await fetch('https://api.artonline.site/countdown')
      this.value = await response.text()
    })()
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

  reset() {
    this.min = 0
    this.hours = 0
    this.days = 0
    this.sec = 0
  }

  set value(ms) {
    this.reset()
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


    clearTimeout(this.timeout)

    this.timeout = () => setTimeout(() => {
      this._parse()
      if (this.days !== 0 || this.hours !== 0 || this.sec !== 0 || this.min !== 0 ) this.timeout()
    }, 1000);
    this._parse()
    this.timeout()

  }

  _parse() {
    if (!this.sec && this.min > 0 || this.sec === 0 && this.min > 0) {
      this.min -= 1
      this.sec = 60
    }
    this.sec -= 1

    this.sqs('.days').innerHTML = this.days > 0 ? `${String(this.days).length !== 1 ? this.days : `0${this.days}`} :` : ''
    this.sqs('.hours').innerHTML = this.hours > 0 ? `${String(this.hours).length !== 1 ? this.hours : `0${this.hours}`} : ` : ''
    this.sqs('.min').innerHTML = this.min > 0 ? `${String(this.min).length !== 1 ? this.min : `0${this.min}`} : ` : ''
    this.sqs('.sec').innerHTML = this.sec > 0 ? String(this.sec).length !== 1 ? this.sec : `0${this.sec}` : ''
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
        font-size: 40px;
      }

      flex-row {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        align-items: baseline;
      }
    </style>
    <loading-animation></loading-animation>
<flex-row>
  <span class="days"></span>
  <span class="hours"></span>
  <span class="min"></span>
  <span class="sec"></span>
</flex-row>
    `
  }
})

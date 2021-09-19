import addresses from './../../addresses/addresses.js'
import './../node_modules/@vandeurenglenn/custom-select/custom-select'
import './../node_modules/@andrewvanardennen/custom-input/custom-input'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-row'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-column'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-one'

import Api from './api';
import './elements/gpu-img'
export default customElements.define('arteon-calculator', class ArteonCalculator extends HTMLElement {

  get _networkSelect() {
    return this.shadowRoot.querySelector('.network')
  }

  get _gpuSelect() {
    return this.shadowRoot.querySelector('.gpu')
  }

  get _timeSelect() {
    return this.shadowRoot.querySelector('.time')
  }

  get _img() {
    return this.shadowRoot.querySelector('gpu-img')
  }

  get gpus() {
    return this.addresses.cards
  }

  set rewardPerGPU(value) {
    const period = this.timeInput.value // returns minutes
    const format = this.timeInput.format // seconds, minutes, hours, days ...
    const divideOrMultiply = this.timeInput.divideOrMultiply
    this.shadowRoot.querySelector('.rewards').innerHTML = divideOrMultiply === 'multiply' ? value * period : value / period
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._onGpuSelected = this._onGpuSelected.bind(this)
  }

  connectedCallback() {
    this._setup()
  }

  async _setup() {
    globalThis.api = new Api()
    this.addresses = await addresses('mainnet')

    for (const key of Object.keys(this.gpus)) {
      const el = document.createElement('span')
      el.innerHTML = key
      el.dataset.address = this.gpus[key]
      el.dataset.route = key
      this._gpuSelect.appendChild(el)
    }
    this._gpuSelect.selected = 'GENESIS'
    this._timeSelect.selected = 'day'
    this._img.symbol = 'GENESIS'

    this._gpuSelect.addEventListener('selected', this._onGpuSelected)
  }

  async _onGpuSelected({detail}) {
    this._img.symbol = detail.includes('artx') ?
      detail.replace('artx', 'ARTX ') : detail.toUpperCase()

    this.contract = new ethers.Contract(this.addresses.cards[detail])
    console.log(event);
  }

  async _getReward() {
    this.rewardPerGPU = await this.contract.callstatic.rewardPerGPU()
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        background: var(--main-background);
        color: var(--main-color);
      }

      .hero {
        padding: 24px;
        box-sizing: border-box;
        max-width: 320px;
        width: 100%;
        align-items: center;
        background: var(--custom-drawer-background);
      }

      flex-row {
        width: 100%;
      }

      custom-input {
        min-width: 160px;
      }

      input {
        background: transparent;
        color: var(--main-color);
        border: none;
      }
    </style>

    <flex-column class="hero">

      <gpu-img></gpu-img>
      <flex-row>
        <h4>gpu</h4>
        <flex-one></flex-one>
        <custom-select class="gpu"></custom-select>
      </flex-row>
      <flex-row>
        <input placeholder="amount" type="number" value="1"></input>
        <span class="format"></span>
        <flex-one></flex-one>

        <custom-select class="time">
          <span data-route="ms">ms(s)</span>
          <span data-route="second">second(s)</span>
          <span data-route="minute">minute(s)</span>
          <span data-route="hour">hour(s)</span>
          <span data-route="day">day(s)</span>
          <span data-route="month">month(s)</span>
          <span data-route="year">year(s)</span>
        </custom-select>
      </flex-row>
    </flex-column>
    `
  }
})

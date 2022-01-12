import './../elements/gpu-select'

import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-column'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-row'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-one'
import PLATFORM_ABI from './../../../abis/platform'
import MINING_ABI from './../../../abis/mining'

export default customElements.define('calculator-view', class CalculatorView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._onselect = this._onselect.bind(this)
    this._onperiod = this._onperiod.bind(this)
    this._oninput = this._oninput.bind(this)
  }

  connectedCallback() {
    this.contract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, api.provider)
    this.miningContract = new ethers.Contract(api.addresses.mining, MINING_ABI, api.provider)

    this.shadowRoot.querySelector('gpu-select').addEventListener('selected', this._onselect)
    this.shadowRoot.querySelector('custom-select').addEventListener('selected', this._onperiod)
    this.shadowRoot.querySelector('custom-input').addEventListener('input', this._oninput)
    this.shadowRoot.querySelector('custom-input.gpus').addEventListener('input', this._oninput)
    this.shadowRoot.querySelector('custom-select').selected = 'min'
    this._onselect({detail: 'GENESIS'})
  }

  _calculateRewards(rewards, format) {
    rewards = Number(ethers.utils.formatUnits(rewards, 18))
    if (format === 'min') rewards *= 60
    if (format === 'hr') rewards *= 3600
    if (format === 'day') rewards *= 86400
    if (format === 'week') rewards *= 604800
    if (format === 'month') rewards *= 2.628e+6
    if (format === 'year') rewards *= 3.154e+7
    return rewards
  }

  async _oninput() {
    const detail = this.shadowRoot.querySelector('gpu-select').selected
    const id = this.shadowRoot.querySelector('gpu-select').shadowRoot.querySelector(`[data-route="${detail}"]`).dataset.index
    const rewardsPerSec = await this.miningContract.callStatic.getMaxReward(id)
    const cap = await this.contract.callStatic.cap(id)
    let miners = this.shadowRoot.querySelector('custom-input').input.value
    if (Number(miners) > cap.toNumber()) this.shadowRoot.querySelector('custom-input').input.value = cap

    const rewards = this._calculateRewards(rewardsPerSec, this.shadowRoot.querySelector('custom-select').selected)
    const gpus = Number(this.shadowRoot.querySelector('custom-input.gpus').input.value)
    this.shadowRoot.querySelector('.rewards').innerHTML = Math.round(((Number(rewards) / Number(this.shadowRoot.querySelector('custom-input').input.value)) * gpus) * 1000) / 1000
  }

  async _onperiod() {
    const detail = this.shadowRoot.querySelector('gpu-select').selected
    const id = this.shadowRoot.querySelector('gpu-select').shadowRoot.querySelector(`[data-route="${detail}"]`).dataset.index
    const rewardsPerSec = await this.miningContract.callStatic.getMaxReward(id)
    const cap = await this.contract.callStatic.cap(id)
    const miners = this.shadowRoot.querySelector('custom-input').input.value

    const rewards = this._calculateRewards(rewardsPerSec, this.shadowRoot.querySelector('custom-select').selected)
    const gpus = Number(this.shadowRoot.querySelector('custom-input.gpus').input.value)
    this.shadowRoot.querySelector('.rewards').innerHTML = Math.round(((Number(rewards) / Number(miners > cap ? cap : miners)) * gpus) * 1000) / 1000
  }

  async _onselect({detail}) {
    if (this.contract && detail !== 'overview') {
      const id = this.shadowRoot.querySelector('gpu-select').shadowRoot.querySelector(`[data-route="${detail}"]`).dataset.index
      const miners = await this.contract.callStatic.cap(id)
      this.shadowRoot.querySelector('custom-input').input.value = miners.toNumber()

      const rewardsPerSec = await this.miningContract.callStatic.getMaxReward(id)

      const rewards = this._calculateRewards(rewardsPerSec, this.shadowRoot.querySelector('custom-select').selected)
      const gpus = Number(this.shadowRoot.querySelector('custom-input.gpus').input.value)
      this.shadowRoot.querySelector('.rewards').innerHTML = Math.round(((Number(rewards) / Number(this.shadowRoot.querySelector('custom-input').input.value)) * gpus) * 1000) / 1000
    }

  }

  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        align-items: center;
        justify-content: center;
        color: var(--main-color);
      }

      .hero {
        border-radius: 24px;
        box-sizing: border-box;
        border: 1px solid #fff;
        max-width: 320px;
        width: 100%;
        padding: 24px;
      }

      [center] {
        align-items: center;
      }

      custom-select {
        padding-left: 0;
      }

      .selector {
        padding: 0 12px;
        box-sizing: border-box;
      }

      .miners {
        padding-bottom: 48px;
      }

      custom-input {
        width: 60px;
        min-width: auto;
        pointer-events: auto;
        --custom-input-color: var(--main-color);
        --custom-input-height: 24px;
      }
    </style>
    <flex-column class="hero">
      <gpu-select></gpu-select>
      <flex-row class="selector" center>
        <strong>MINERS</strong>
        <flex-one></flex-one>
        <custom-input></custom-input>
      </flex-row>
      <flex-row class="selector miners" center>
        <strong>GPU'S</strong>
        <flex-one></flex-one>
        <custom-input type="number" class="gpus" value="1"></custom-input>
      </flex-row>
      <flex-row class="selector" center>
        <strong class="rewards"></strong>
        <flex-one></flex-one>
        <strong>ART</strong>
        <span>/</span>
        <custom-select>
          <flex-row data-route="sec"><span>second</span></flex-row>
          <flex-row data-route="min"><span>minute</span></flex-row>
          <flex-row data-route="hr"><span>hour</span></flex-row>
          <flex-row data-route="day"><span>day</span></flex-row>
          <flex-row data-route="week"><span>week</span></flex-row>
          <flex-row data-route="month"><span>month</span></flex-row>
          <flex-row data-route="year"><span>year</span></flex-row>
        </custom-select>
      </flex-row>
    </flex-column>

    `
  }
})

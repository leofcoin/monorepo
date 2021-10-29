import './../elements/gpu-select'

import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-column'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-row'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-one'
import PLATFORM_ABI from './../../../abis/platform'

export default customElements.define('calculator-view', class CalculatorView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._onselect = this._onselect.bind(this)
    this._onperiod = this._onperiod.bind(this)
  }

  connectedCallback() {
    this.contract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, api.provider)
    this.shadowRoot.querySelector('gpu-select').addEventListener('selected', this._onselect)
    this.shadowRoot.querySelector('custom-select').addEventListener('selected', this._onperiod)
    this.shadowRoot.querySelector('custom-select').selected = 'min'
    this._select({detail: 'GENESIS'})
  }

  _calculateRewards(rewards, format) {
    console.log(rewards, format);
    if (format === 'sec') rewards = rewards.div(60)
    if (format === 'hr') rewards = rewards.mul(60)
    if (format === 'day') rewards = rewards.mul(60 * 24)
    if (format === 'week') rewards = rewards.mul((60 * 24) * 7)
    if (format === 'month') rewards = rewards.mul((60 * 24) * 30)
    if (format === 'year') rewards = rewards.mul((60 * 24) * 365)
    return ethers.utils.formatUnits(rewards, 18)

  }

  async _onperiod({detail}) {
    const pools = await api.poolNames()
    const id = pools.indexOf(this.shadowRoot.querySelector('gpu-select').selected)
    const rewardsPerMinute = await this.contract.callStatic.getMaxReward(id)
    const miners = await this.contract.callStatic.miners(id)
    const rewards = this._calculateRewards(rewardsPerMinute.div(miners), this.shadowRoot.querySelector('custom-select').selected)
    this.shadowRoot.querySelector('.rewards').innerHTML = Math.round(Number(rewards.slice(0,20)) * 1000000) / 1000000
  }

  async _onselect({detail}) {
    console.log(detail, this.contract);
    if (this.contract && detail !== 'overview') {
      const pools = await api.poolNames()
      const id = pools.indexOf(detail)
      const rewardsPerMinute = await this.contract.callStatic.getMaxReward(id)
      const miners = await this.contract.callStatic.miners(id)
      const rewards = this._calculateRewards(rewardsPerMinute.div(miners), this.shadowRoot.querySelector('custom-select').selected)
      this.shadowRoot.querySelector('.rewards').innerHTML = Math.round(Number(rewards.slice(0,7)) * 10000) / 10000

      console.log(detail, pools);
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
    </style>
    <flex-column class="hero">
      <gpu-select></gpu-select>
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

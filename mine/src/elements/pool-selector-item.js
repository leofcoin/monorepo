import PLATFORM_ABI from './../../../abis/platform.js'
import MINING_ABI from './../../../abis/mining.js'
import './../array-repeat'
import './arteon-button'
import './gpu-img'
import {rotate, rotateBack} from './../styles/shared'
import { LitElement, html } from 'lit'

export default customElements.define('pool-selector-item', class PoolSelectorItem extends LitElement {

  static properties = {
    symbol: {
      type: String
    },
    id: {
      type: String
    },
    bonus: {
      type: String
    },
    address: {
      type: String
    },
    miners: {
      type: Number
    },
    difficulty: {
      type: Number
    },
    miners: {
      type: Number
    },
    earned: {
      type: Number
    },
    earnedShort: {
      type: String
    },
    maxReward: {
      type: Number
    },
    maxRewardShort: {
      type: String
    }
  }

  constructor() {
    super()
  }

  #id

  set id(value) {
    this.#id = value
    this._parse()
  }

  get id() {
    return this.#id
  }

  async _parse() {
    let platform = api.getContract(api.addresses.platform, PLATFORM_ABI, true)
    let mining = api.getContract(api.addresses.mining, MINING_ABI, true)
    let promises;
    try {
      await api.timeout;
      promises = [
        mining.callStatic.poolInfo(api.signer.address, ethers.BigNumber.from(this.#id)),
        platform.callStatic.cap(ethers.BigNumber.from(this.#id))
      ]
      promises = await Promise.all(promises)
      promises = [...promises[0], promises[1]]
    } catch (e) {
      promises = [
        mining.callStatic.poolInfo(api.signer.address, ethers.BigNumber.from(this.#id)),
        platform.callStatic.cap(ethers.BigNumber.from(this.#id))
      ]
      promises = await Promise.all(promises)
      promises = [...promises[0], promises[1]]
    }

    this.miners = promises[0].toNumber() < promises[4] ? promises[0].toNumber() : promises[4]
    this.maxReward = ethers.utils.formatUnits(promises[1], 18)
    this.earned = ethers.utils.formatUnits(promises[2], 18)
    this.maxRewardShort = Math.round(Number(this.maxReward * 1000)) / 1000
    this.earnedShort = Math.round(Number(this.earned * 1000)) / 1000
    this.difficulty = Math.round((this.miners / promises[4].toNumber() * 1000)) / 1000
    this.nextHalving = new Date(promises[3].toNumber() * 1000).toLocaleDateString()

    if (this.timeout) clearTimeout(this.timeout)

    this.timeout = () => setTimeout(async () => {
      const earned = await mining.callStatic.earned(api.signer.address, this.#id)
      this.earned = ethers.utils.formatUnits(earned, 18)
      this.earnedShort = Math.round(Number(this.earned * 1000)) / 1000
      const el = this.shadowRoot.querySelector('span.earned')
      el.title = `earned: ${this.earned}`
      el.innerHTML = this.earnedShort
      const miners = await mining.callStatic.miners(ethers.BigNumber.from(this.#id))
      this.miners = miners.toNumber() < promises[4] ? miners.toNumber() : promises[4]
      this.difficulty = Math.round((this.miners / promises[4].toNumber() * 1000)) / 1000      
      this.timeout()
    }, 120000);

    this.timeout()

  }
// hardware:toys
  render() {
    return html`
    <style>
      * {
        pointer-events: none;
      }
      :host {
        color: var(--main-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        border-bottom: 1px solid #333;
        box-sizing: border-box;
        // padding: 12px 48px 12px 48px;
        padding: 0 24px 24px 24px;
        background: #eee;
        color: #333;
        pointer-events: auto;
      }
      h4 {
        margin: 0;
        padding: 6px 0 12px 12px;
        box-sizing: border-box;
      }
      img {
        margin-top: 24px;
        width: 320px;
      }

      flex-row {
        width: 100%;
      }

      .explainer {
        padding: 0 6px;
      }

      .logo {
        height: 20px;
        width: 20px;
        margin: 0;
        margin-left: 12px;
        box-sizing: border-box;
      }

      custom-svg-icon {
        margin-left: 12px;
        
        --svg-icon-color: var(--main-color);
      }
      .info {
        padding-right: 24px;
        box-sizing: border-box;
      }
      flex-row[data-route="overview"] {
        align-items: flex-end;
      }
      @media (max-width: 840px) {
        flex-row[data-route="overview"] {
          flex-direction: column !important;
          align-items: center;
        }
      }
      ${rotateBack}
      ${rotate}
    </style>
    <flex-row data-route="overview">
      <flex-column class="info" style="width: 100%;">
        <h4><strong>${this.symbol}</strong></h4>
        <flex-row>
          <custom-svg-icon icon="memory"></custom-svg-icon>
          <span class="explainer">miners</span>
          <flex-one></flex-one>
          <span>${this.miners}</span>
        </flex-row>
        <flex-row>
          <custom-svg-icon icon="compare-arrows"></custom-svg-icon>
          <span class="explainer">maxReward</span>
          <flex-one></flex-one>
          <span title="${this.maxReward}">${this.maxRewardShort}</span>
        </flex-row>
        <flex-row>
          <custom-svg-icon icon="build"></custom-svg-icon>
          <span class="explainer">difficulty</span>
          <flex-one></flex-one>
          <span>${this.difficulty}</span>
        </flex-row>
        <flex-row>
          <custom-svg-icon icon="build"></custom-svg-icon>
          <span class="explainer">nextHalving</span>
          <flex-one></flex-one>
          <span>${this.nextHalving}</span>
        </flex-row>
        <flex-row style="align-items: flex-end; height: 24px;">
          <img class="logo" src="assets/arteon.svg"></img>
          <span class="explainer">earnings</span>
          <flex-one></flex-one>
          <span title="${this.earned}" class="earned">${this.earnedShort}</span>
        </flex-row>
        <flex-one></flex-one>
      </flex-column>
      <gpu-img symbol="${this.symbol}" loading="lazy"></gpu-img>
    </flex-row>
      <!-- <custom-svg-icon icon="arrow-drop-down"></custom-svg-icon> -->
    `
  }
})

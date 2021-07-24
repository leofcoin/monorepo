import MINER_ABI from './../abis/miner.js'
import POOL_ABI from './../abis/pool.js'
import GPU_ABI from './../abis/gpu.js'
import ARTEON_ABI from './../abis/arteon.js'
import './../array-repeat'
import './arteon-button'
import './gpu-img'
import {rotate, rotateBack} from './../styles/shared'
export default customElements.define('pool-selector-item', class PoolSelectorItem extends HTMLElement {
  static get observedAttributes() {
    return ['address']
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
  }

  connectedCallback() {
    if (!this.address) this.address = this.getAttribute('address')
  }

  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value
  }

  set address(address) {
    this._address = address
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, MINER_ABI, api.signer)
    this._render(address);
  }

  get address() {
    return this._address
  }

  async _render(address) {
    let contract = globalThis._contracts[address] || new ethers.Contract(address, MINER_ABI, api.signer)
    console.log(await contract.callStatic.ARTEON_GPU());



    let promises = [
      contract.callStatic.ARTEON_GPU(),
      contract.callStatic.miners(),
      contract.callStatic.getMaxReward(),
      contract.callStatic.earned(),
      contract.callStatic.ARTEON_TOKEN()
    ]

    promises = await Promise.all(promises)
    globalThis._contracts[promises[0]] = globalThis._contracts[promises[0]] || new ethers.Contract(promises[0], GPU_ABI, api.signer)

    this.symbol = await globalThis._contracts[promises[0]].callStatic.symbol()
    this.miners = promises[1]
    this.maxReward = ethers.utils.formatUnits(promises[2], 18)
    this.earned = ethers.utils.formatUnits(promises[3], 18)
    this.maxRewardShort = Math.round(Number(this.maxReward * 1000)) / 1000
    this.earnedShort = Math.round(Number(this.earned * 1000)) / 1000

    this.difficulty = Math.round((this.miners / api.maximumSupply[this.symbol]) * 1000) / 1000
    // this.rewards = promises[4]
    // promises = [
      // contract
      // contract.callStatic.maxReward(),
      // contract.callStatic.earned(),
      // contract.callStatic.rewards(api.signer.address)
    // ]
    console.log({...promises});
    this.shadowRoot.innerHTML = this.template

    // this.shadowRoot.querySelector('array-repeat').items = pools
    // this.shadowRoot.querySelector('custom-select').selected = pools[0].symbol
    contract.on('Activate', (address, tokenId) => {
      this.miners = Number(this.miners) + 1
      this.difficulty = Math.round((this.miners / api.maximumSupply[this.symbol]) * 1000) / 1000
      this.shadowRoot.innerHTML = this.template
    })

    contract.on('Deactivate', (address, tokenId) => {
      this.miners = Number(this.miners) - 1
      this.difficulty = Math.round((this.miners / api.maximumSupply[this.symbol]) * 1000) / 1000
      this.shadowRoot.innerHTML = this.template
    })
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = () => setTimeout(async () => {
      const earned = await contract.callStatic.earned()
      this.earned = ethers.utils.formatUnits(earned, 18)
      this.earnedShort = Math.round(Number(this.earned * 1000)) / 1000
      const el = this.shadowRoot.querySelector('span.earned')
      el.title = `earned: ${this.earned}`
      el.innerHTML = this.earnedShort
      this.timeout()
    }, 10000);

    this.timeout()
  }
// hardware:toys
  get template() {
    return `
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
      array-repeat {
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

      custom-svg-icon {
        margin-left: 12px;
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
            <custom-svg-icon icon="attach-money"></custom-svg-icon>
            <span class="explainer">earned</span>
            <flex-one></flex-one>
            <span title="${this.earned}" class="earned">${this.earnedShort}</span>
          </flex-row>
          <flex-one></flex-one>

          <flex-row>
            <custom-svg-icon icon="gift"></custom-svg-icon>
            <span class="explainer">reward</span>
            <flex-one></flex-one>
            <custom-select>
              <array-repeat>
                <template>
                  <span class="item" title="[[item.address]]" data-route="[[item.symbol]]" data-address="[[item.address]]">
                    [[item.symbol]]
                  </span>
                </template>
              </array-repeat>
            </custom-select>
          </flex-row>
        </flex-column>
        <gpu-img symbol="${this.symbol}" loading="lazy"></gpu-img>
      </flex-row>
      <!-- <custom-svg-icon icon="arrow-drop-down"></custom-svg-icon> -->
    `
  }
})

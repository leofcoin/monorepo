import MINER_ABI from './../abis/miner.js'
import GPU_ABI from './../abis/gpu.js'
import './../array-repeat'
import './arteon-button'
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
    let contract = globalThis._contracts[address]
    let promises = [
      contract.callStatic.ARTEON_GPU(),
      contract.callStatic.miners(),
      contract.callStatic.getMaxReward(),
      contract.callStatic.earned()
    ]

    promises = await Promise.all(promises)
    globalThis._contracts[promises[0]] = globalThis._contracts[promises[0]] || new ethers.Contract(promises[0], GPU_ABI, api.signer)

    this.symbol = await globalThis._contracts[promises[0]].callStatic.symbol()
    this.miners = promises[1]
    this.maxReward = ethers.utils.formatUnits(promises[2], 18)
    this.earned = ethers.utils.formatUnits(promises[3], 18)
    this.maxRewardShort = Math.round(Number(this.maxReward * 1000)) / 1000
    this.earnedShort = Math.round(Number(this.earned * 1000)) / 1000

    this.difficulty = (this.miners / api.maximumSupply[this.symbol])
    // this.rewards = promises[4]
    // this.URI = `https://nft.arteon.org/cards/${api.assets[this.symbol]}`
    this.URI = api.assets[this.symbol]
    // promises = [
      // contract
      // contract.callStatic.maxReward(),
      // contract.callStatic.earned(),
      // contract.callStatic.rewards(api.signer.address)
    // ]
    console.log({...promises});
    this.shadowRoot.innerHTML = this.template
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
        padding: 0 24px 12px 24px;
        background: #eee;
        color: #333;
        pointer-events: auto;
      }
      h4 {
        margin: 0;
        padding: 14px 0 44px 0;
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

      @media (max-width: 840px) {
        flex-row[data-route="overview"] {
          flex-direction: column !important;
          align-items: center;
        }
      }
    </style>
      <flex-row data-route="overview">
        <flex-column style="width: 100%;">
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
            <span title="${this.earned}">${this.earnedShort}</span>
          </flex-row>
          <flex-one></flex-one>
        </flex-column>
        <img src="${this.URI}" loading="lazy"></img>

      </flex-row>
      <!-- <custom-svg-icon icon="arrow-drop-down"></custom-svg-icon> -->
    `
  }
})

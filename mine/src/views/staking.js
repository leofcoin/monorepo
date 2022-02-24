import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-column'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-row'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-one'
import STAKING_ABI from './../../../abis/staking'
import './../elements/claim-stake'

export default customElements.define('staking-view', class StakingView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._onClick = this._onClick.bind(this)
  }

  connectedCallback() {
    this.contract = new ethers.Contract(api.addresses.staking, STAKING_ABI, api.provider)
    this._init()
  }

  async _onClick(event) {
    const target = event.composedPath()[0]
    if (!target.hasAttribute('data-action')) return

    const stakeId = target.getAttribute('stake-id')
    const claimable = await this.contract.callStatic.readyToRelease(api.signer.address, stakeId)
    if (claimable) {
      this.contract = new ethers.Contract(api.addresses.staking, STAKING_ABI, api.signer)
      const tx = await this.contract.withdraw(api.signer.address, stakeId)
      // tx.hash
      await tx.wait()
      console.log(tx);
    }
  }

  async _init() {
    const stakeIds = await this.contract.callStatic.stakeIds(api.signer.address)
    const items = []
    this.totalStaked = 0
    for (const stakeId of stakeIds) {
      const amount = await this.contract.callStatic.stakeAmount(api.signer.address, stakeId)
      const claimed = await this.contract.callStatic.claimed(api.signer.address, stakeId)
      this.totalStaked += Number(ethers.utils.formatUnits(amount))
      let releaseTime = 0;
      let claimable = false
      if (!claimed) {
        releaseTime = await this.contract.callStatic.stakeReleaseTime(api.signer.address, stakeId)
        claimable = releaseTime < Math.round(new Date().getTime() / 1000);
      }
      items.push({stakeId, shortStakeId: `${stakeId.slice(0, 5)}...${stakeId.slice(stakeId.length - 6, stakeId.length - 1)}`, amount: ethers.utils.formatUnits(amount), claimed, claimable, releaseTime: releaseTime.toString()})
    }
    this.shadowRoot.querySelector('.totalStaked').innerHTML = this.totalStaked
    this.shadowRoot.querySelector('array-repeat').items = items
    this.shadowRoot.addEventListener('click', this._onClick)
    // this.contract.sta
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
        max-width: 640px;
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
      .totalStaked {
        padding-bottom: 24px;
        padding-left: 6px;
      }


      .hero {
        overflow-y: auto;
      }
      array-repeat {
        overflow-y: auto !important;
        pointer-events: auto !important;
      }
    </style>
    <flex-column class="hero">
    <flex-row>
      <strong>totalStaked :</strong>
      <span class="totalStaked"></span>
    </flex-row>
    <array-repeat>
      <style>
      [claimable="true"] {
        pointer-events: auto !important;
      }
      </style>
      <template>
        <flex-column>
          <span style="padding-right:24px;">[[item.shortStakeId]]</span>
          <flex-row style="align-items: center;">
            <span>[[item.amount]]</span>
            <flex-one></flex-one>
            <claim-stake data-action="claim" stake-id="[[item.stakeId]]" claimed="[[item.claimed]]" release="[[item.releaseTime]]" claimable="[[item.claimable]]"></claim-stake>
          </flex-row>
        </flex-column>
      </template>
    </array-repeat>
    </flex-column>

    `
  }
})

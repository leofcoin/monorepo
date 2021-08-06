import POOL_ABI from './../abis/pool.js'
import GPU_ABI from './../abis/gpu.js'
import './../array-repeat'
import './pool-selector-item'
import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import {elevation2dp} from './../styles/elevation'
import {scrollbar} from './../styles/shared'

export default customElements.define('pool-selector', class PoolSelector extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._select = this._select.bind(this)
    this._onclick = this._onclick.bind(this)
  }

  connectedCallback() {
    this._load()
    this.addEventListener('click', this._onclick)
    this._selector.addEventListener('selected', this._select)
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  async _isOwner() {

    return api.signer ? await this.contract.owner() === api.signer.address : false
  }

  async _load() {
    this.contract = api.getContract(api.addresses.factory, POOL_ABI)
    if (await this._isOwner()) this._ownerSetup()

    const cardsLength = await this.contract.callStatic.tokens()
    let promises = []

    for (var i = 0; i < cardsLength; i++) {
      promises.push(this.contract.callStatic.listedTokens(i))
    }
    promises = await Promise.all(promises)

    this._arrayRepeat.items = promises.map(address => {
      return {address}
    })
  }

  _select({detail}) {
    // const target = event.composedPath()[0]
    // const route = target.getAttribute('data-route')

    if (detail === 'overview' || detail === 'back') {
      this._pages.select('overview')
      if (detail === 'back') history.back()

      return
    }

    if (detail) {
      this._pages.select('pool')
      this.shadowRoot.querySelector('nft-pool')._load(detail)
      return
    }
  }

  _ownerSetup() {
    this.setAttribute('is-owner', '')
    const repeat = this.shadowRoot.querySelector('custom-select').querySelector('array-repeat')
    repeat.items = Object.keys(api.addresses.cards).map(key => {
      return {
        name: key,
        address: api.addresses.cards[key]
      }
    })

    const _onGPUSelected = ({detail}) => {
      console.log(detail);
      this.shadowRoot.querySelector('[data-target="add-pool"]').querySelector('[data-input="address"]').value = api.addresses.cards[detail]
    }
    _onGPUSelected({detail: 'genesis'})
    this.shadowRoot.querySelector('custom-select').selected = 'genesis'
    this.shadowRoot.querySelector('custom-select').addEventListener('selected', _onGPUSelected)
  }

  async _onclick(event) {
    const target = event.composedPath()[0]
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action')
      let _target
      let listing
      switch (action) {
        case 'add-pool':
          this.shadowRoot.querySelector('[data-input="tokenAddress"]').value = api.addresses.token
          this._showDialog(action)
          break;
      }
      return
    } else if (target.hasAttribute('data-route')) {
      console.log(target);
      this._selector.select(target.getAttribute('data-route'))
    }
  }

  async _showDialog(target) {
    const {action, value} = await this.shadowRoot.querySelector(`[data-target="${target}"]`).show()

    if (action === 'confirm') {
      switch (target) {
        case 'add-pool':
          this._addPool(value)
          break;
      }
    }
  }

  async _addPool({address, tokenAddress, blocktime, rewardRate, halving}) {
    console.log({address, tokenAddress, blocktime, rewardRate, halving});
    const contract = api.getContract(address, GPU_ABI, true)
    console.log(contract);
    const supplyCap = await contract.callStatic.supplyCap()
    console.log(supplyCap);
    const tx = await this.contract.addToken(
      address,
      tokenAddress,
      ethers.BigNumber.from(blocktime),
      ethers.utils.parseUnits(((Number(rewardRate) / 2.102e+7) * supplyCap.toNumber()).toString(), 18),
      ethers.BigNumber.from(halving))

      console.log(tx);
  }

// hardware:toys
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding: 0 24px;
        padding-top: 24px;
        justify-content: center;
      }

      section {
        display: flex;
        align-items: center;
      }

      .container {
        padding: 32px 0 6px 0;
        border-radius: 44px;
        width: 100%;
        height: 100%;
        max-width: 640px;
        background: var(--custom-drawer-background);
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        max-height: 756px;
        ${elevation2dp}
        box-shadow: 0 1px 18px 0px var(--accent-color);
      }

      custom-input {
        pointer-events: auto;
        padding: 12px;
        box-sizing: border-box;
        max-width: 640px;
        background: var(--custom-drawer-background);
        --custom-input-color: var(--main-color);
        border-radius: 24px;

        ${elevation2dp}
      }
      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
      custom-pages {
        height: 100%;
      }

      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
      }

      .owner-controls {
        opacity: 0;
        pointer-events: none !important;
      }

      :host([is-owner]) .owner-controls.showable button {
        pointer-events: none;
      }

      :host([is-owner]) .owner-controls.showable, :host([is-owner]) .owner-controls.showable button {
        opacity: 1;
        pointer-events: auto;
      }

      arteon-dialog {
        --svg-icon-color: #eee;
      }

      arteon-dialog flex-row.price {
        padding: 0 12px 12px 12px;
        box-sizing: border-box;
      }

      arteon-dialog flex-row.price strong {
        padding-left: 6px;
      }

      flex-row.owner-buttons {
        position: absolute;
        right: 0;
        bottom: 0;
        transform: translateX(-50%);
        z-index: 1010;
        --svg-icon-color: #eee;
      }
      custom-input {
        pointer-events: auto;
        padding: 12px;
        box-sizing: border-box;
        max-width: 640px;
        background: var(--custom-drawer-background);
        --custom-input-color: var(--main-color);
        border-radius: 24px;
        margin-bottom: 24px;
        ${elevation2dp}
      }
      h4 {
        margin: 0;
      }
      array-repeat {
        pointer-events: auto;
      }
      ${scrollbar}
    </style>
    <!--
    <custom-input placeholder="search by name/address"></custom-input>
    <flex-one></flex-one>

    -->

    <flex-row class="owner-buttons owner-controls showable">
      <button data-action="add-pool">
        <custom-svg-icon icon="add"></custom-svg-icon>
        <flex-one></flex-one>
        <strong>ADD POOL</strong>
      </button>
    </flex-row>
    <span class="container">
      <custom-pages attr-for-selected="data-route">
        <custom-selector data-route="overview" attr-for-selected="data-route">
          <array-repeat data-route="overview">

            <style>
              pool-selector-item {
                background: #ee44ee26;
                color: #eee;
              }
              pool-selector-item:nth-of-type(odd) {
                background: transparent;
              }
              pool-selector-item {
                pointer-events: auto;
                cursor: pointer;
              }
              </style>
            <template>
              <pool-selector-item address="[[item.address]]" data-route="[[item.address]]"></pool-selector-item>
            </template>
          </array-repeat>
        </custom-selector>
        <nft-pool data-route="pool"></nft-pool>
      </custom-pages>
    </span>

    <arteon-dialog class="owner-controls" data-target="add-pool">
      <h4 slot="title">Add Pool</h4>
      <custom-select>
        <array-repeat>
          <template>
            <span class="item" title="[[item.listing]]" data-route="[[item.name]]" data-listing="[[item.listing]]">
              [[item.name]]
            </span>
          </template>
        </array-repeat>
      </custom-select>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <custom-input data-input="tokenAddress" placeholder="tokenAddress"></custom-input>
      <custom-input data-input="blocktime" placeholder="blocktime"></custom-input>
      <custom-input data-input="rewardRate" placeholder="reward rate"></custom-input>
      <custom-input data-input="halving" placeholder="halving (days)"></custom-input>
    </arteon-dialog>
    `
  }
})

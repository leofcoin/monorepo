import pools from './../data/pools'
import './../elements/nft-pool'
import './../elements/pool-selector'

export default customElements.define('pools-view', class PoolsView extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  connectedCallback() {
    // this._select({detail: api.addresses.pools.GENESIS})
  }

  _select({detail}) {
    this.shadowRoot.querySelector('pool-selector')._select({detail})
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: calc(100% - 54px);
      }
    </style>

    <pool-selector></pool-selector>
    `
  }
})

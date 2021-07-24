import MINER_ABI from './../abis/miner.js'
import GPU_ABI from './../abis/gpu.js'
import './nft-pool-card'

const mp4s = {
  GENESIS: 'Genesis.mp4',
  'ARTX 1000': 'ARTX1000.mp4',
  'ARTX 2000': 'ARTX2000.mp4'
}

export default customElements.define('nft-pool-cards', class NFTPoolCards extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._contracts = []
  }

  async _load(cards) {
    console.log(cards);
      this.innerHTML = ''

    for (const {tokenId, mining = false} of cards) {
      const card = document.createElement('nft-pool-card')
      card.setAttribute('token-id', tokenId)
      card.setAttribute('mining', mining)
      card.setAttribute('data-id', tokenId)
      card.setAttribute('status', mining ? 'activated' : 'deactivated')
      this.appendChild(card)
    }
  }
// hardware:toys
  get template() {
    return `
    <style>
      :host {
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        width: 100%;
        padding-top: 48px;
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
      }

      section {
        display: flex;
        align-items: center;
      }

      ::slotted(span) {
        display: flex;
        width: 100%;
        align-items: center;
      }
    </style>
    <slot></slot>
    `
  }
})

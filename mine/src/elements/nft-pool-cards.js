import MINER_ABI from './../abis/miner.js'
import GPU_ABI from './../abis/gpu.js'

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

    for (const id of cards) {
      const span = document.createElement('span')
      span.innerHTML = `<custom-svg-icon icon="fan"></custom-svg-icon>
      <strong>${id}</strong>
      <span class="flex"></span>
      <button data-action="mine" data-id="${id}">mine</button>
      `

      this.appendChild(span)
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

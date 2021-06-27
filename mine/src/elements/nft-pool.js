import MINER_ABI from './../abis/miner.js'
import GPU_ABI from './../abis/gpu.js'
import './nft-pool-cards'

globalThis._contracts = globalThis._contracts || []

const mp4s = {
  GENESIS: 'Genesis.mp4',
  'ARTX 1000': 'ARTX1000.mp4',
  'ARTX 2000': 'ARTX2000.mp4'
}

export default customElements.define('nft-pool', class NFTPool extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._onclick = this._onclick.bind(this)
  }

  connectedCallback() {
    this.addEventListener('click', this._onclick)
  }

  set address(value) {
    if (this.address !== value) this._load(value)
  }

  get address() {
    return this._address
  }

  async showAddDialog() {
    const result = await prompt('enter gpu (token) ID')
    if (!result) return
    let cards = await localStorage.getItem(`arteon-gpu-${this.symbol}-${api.chainId}`)
    cards = cards ? JSON.parse(cards) : []
    cards.push(result)
    await localStorage.setItem(`arteon-gpu-${this.symbol}-${api.chainId}`, JSON.stringify(cards))
    console.log(result);
  }

  async _onclick(event) {
    const target = event.composedPath()[0]
    if (!target.hasAttribute('data-action')) return

    const action = target.getAttribute('data-action')

    if (action === 'add') {
      const balance = await this.gpuContract.callStatic.balanceOf(api.signer.address)
      if (balance.toNumber() === 0) return this.showBalanceDialog()

      return this.showAddDialog()
    }

    const id = target.dataset.id
    console.log(id);
    if (action === 'mine') {
      let mine;
      try {
        let approved = await this.gpuContract.callStatic.getApproved(id)
        if (approved !== this.contract.address) {
          approved = await this.gpuContract.approve(this.contract.address, id)
          await approved.wait()
        }
        mine = await this.contract.functions.activateGPU(id)
      } catch (e) {
        console.error(e);
        // const gasLimit = Number(e.message.match(/want \d*/)[0].replace('want ', '')) + 5000
        // mine = await this.contract.mine(Number(id), {gasLimit})
      }
      console.log(mine);
      return
    }

    if (action === 'deactivate') {
      return
    }

    this.showBuyDialog()


  }

  async _load(address) {
    console.log(address);
    this._address = address
    this.contract = globalThis._contracts[address] ? globalThis._contracts[address] : new ethers.Contract(address, MINER_ABI, api.signer)
    const gpuAddress = await this.contract.callStatic.ARTEON_GPU()
    this.gpuContract = new ethers.Contract(gpuAddress, GPU_ABI, api.signer)
    const symbol = await this.gpuContract.callStatic.symbol()
    this.symbol = symbol
    const mp4 = mp4s[symbol]


    let cards = await localStorage.getItem(`arteon-gpu-${this.symbol}-${api.chainId}`)
    cards = cards ? JSON.parse(cards) : []

    // promises = []
    // let i = 0;
    // let nonce = await api.signer.provider.getTransactionCount(api.signer.address);
    // for (const card of cards) {
    //   nonce++
    //   promises.push(this.contract.ownerOf(card, { nonce }))
    // }
    //
    // promises = await Promise.allSettled(promises)
    // console.log(promises[0]);
    // // TODO: test on owner transfer
    // const notOwned = promises.filter(promise => promise.value ? promise.value !== api.signer.address : true)
    // console.log(notOwned);
    // for (const {value} of notOwned) {
    //   const index = promises.indexOf(value)
    //   promises.splice(index, 1)
    //   cards.splice(index, 1)
    // }
    await localStorage.setItem(`arteon-gpu-${this.symbol}`, JSON.stringify(cards))
    this.shadowRoot.querySelector('nft-pool-cards')._load(cards)
    this.shadowRoot.querySelector('pool-selector-item').setAttribute('address', address)
    console.log(cards);
    console.log(promises);
  }

  get template() {
    return `
    <style>
      :host {
        color: var(--main-color);
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        --svg-icon-color: #eee;
      }

      video {
        // max-width: 320px;
        // width: 100%;
        max-height: 320px;
      }

      section {
        display: flex;
        flex-direction: column;
        max-height: 480px;
        align-items: center;
      }

      summary {
        display: flex;
        flex-direction: column;
        padding: 24px 0 24px 24px;
        box-sizing: border-box;
      }

      button {
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
      }

      .row {
        display: flex;
        width: 100%;
        max-width: 320px;
        box-sizing: border-box;
        padding: 12px 24px;
      }

      nft-pool-cards {
      box-sizing: border-box;
      padding: 12px 24px 24px 24px;
      }

      .flex {
        flex: 1;
      }

      h6 {
        margin: 0;
      }

      custom-svg-icon[icon="close"] {
        position: absolute;
        top: 12px;
        right: 24px;
        --svg-icon-size: 24px;
        box-sizing: border-box;
      }

      pool-selector-item {
        background: inherit;
        color: var(--main-color);
      }
      .toolbar {
        width: 100%;
        height: 40px;
        align-items: center;
        padding: 0 24px;
        box-sizing: border-box;
      }
    </style>

    <section>
      <custom-svg-icon icon="close" data-route="back"></custom-svg-icon>
      <pool-selector-item></pool-selector-item>

    </section>
    <nft-pool-cards></nft-pool-cards>

    <span class="row">
      <button data-action="add">add</button>

      <span class="flex"></span>
    </span>
    `
  }
})

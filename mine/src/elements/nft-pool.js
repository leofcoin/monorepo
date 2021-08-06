import MINER_ABI from './../abis/miner.js'
import GPU_ABI from './../abis/gpu.js'
import './nft-pool-cards'
import { scrollbar } from './../styles/shared'

globalThis._contracts = globalThis._contracts || []


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

  async _onclick(event) {
    const target = event.composedPath()[0]
    if (!target.hasAttribute('data-action')) return

    const action = target.getAttribute('data-action')

    const id = target.dataset.id
    console.log(id);
    if (action === 'getReward') {
      if (api.signer.address === '0x32d8960387d8d124c2d8eb07717288b7965fbe4d') return;

      let earned = await api.getContract(this.contract.address, MINER_ABI, true).callStatic.earned()
      earned = ethers.utils.formatUnits(earned)
      if (Number(earned) >= 1000) {
        const tx = await api.getContract(this.contract.address, MINER_ABI, true).functions.getReward()
        await tx.wait()
      }
      return
    }

    if (action === 'activate') {
      const card = this.shadowRoot.querySelector('nft-pool-cards').querySelector(`[data-id="${id}"]`)
      card.setAttribute('mining', 'true')
      card.setAttribute('status', 'starting')
      let mine;
      let approved;
      try {
        approved = await this.gpuContract.callStatic.isApprovedForAll(api.signer.address, this.contract.address)
      } catch (e) {
        approved = await this.gpuContract.callStatic.getApproved(id)
      }
      try {
        if (approved === false) {
          const tx = await api.getContract(this.gpuContract.address, GPU_ABI, true).setApprovalForAll(this.contract.address, true)
          await tx.wait()
        }
        if (typeof approved !== 'boolean' && approved !== this.contract.address) {
          approved = await api.getContract(this.gpuContract.address, GPU_ABI, true).approve(this.contract.address, id)
          await approved.wait()
        }
        card.removeAttribute('stopped')
        card.setAttribute('status', 'booting')
        card.setAttribute('booting', '')
        mine = await api.getContract(this.contract.address, MINER_ABI, true).functions.activateGPU(id)
        await mine.wait()
        card.removeAttribute('booting', '')
        card.setAttribute('status', 'activated')
      } catch (e) {
        card.removeAttribute('stopping')
        card.setAttribute('stopped', '')
        setTimeout(() => {
          card.setAttribute('mining', 'false')
          card.setAttribute('status', 'deactivated')
        }, 1600);
        // const gasLimit = Number(e.message.match(/want \d*/)[0].replace('want ', '')) + 5000
        // mine = await this.contract.mine(Number(id), {gasLimit})
      }
      return
    }

    if (action === 'deactivate') {
      let mine;
      const card = this.shadowRoot.querySelector('nft-pool-cards').querySelector(`[data-id="${id}"]`)
      try {
        card.setAttribute('slowing-down', '')
        card.setAttribute('status', 'shutting down')
        mine = await api.getContract(this.contract.address, MINER_ABI, true).functions.deactivateGPU(id)
        setTimeout(() => {
          card.removeAttribute('slowing-down')
          card.setAttribute('stopping', '')
        }, 200);
      } catch (e) {
        card.removeAttribute('booting', '')
        card.setAttribute('status', 'activated')
      }
      await mine.wait()
      card.removeAttribute('stopping')
      card.setAttribute('stopped', '')
      setTimeout(() => {
        card.setAttribute('mining', 'false')
        card.setAttribute('status', 'deactivated')
      }, 1600);
      return
    }

    this.showBuyDialog()


  }

  async _load(address) {
    this.shadowRoot.querySelector('nft-pool-cards').innerHTML = ''
    this._address = address
    //
    this.shadowRoot.querySelector('pool-selector-item').setAttribute('address', address)
    // let contract = globalThis._contracts[address] || new ethers.Contract(address, POOL_ABI, api.signer)
    //
    // const poolAddress = await contract.callStatic.getToken(api.addresses.token)
    this.contract = api.getContract(address, MINER_ABI, true)
    this._parseRewards()
    const gpuAddress = await this.contract.callStatic.ARTEON_GPU()
    this.gpuContract = api.getContract(gpuAddress, GPU_ABI, true)
    const symbol = await this.gpuContract.callStatic.symbol()
    this.symbol = symbol
    let cap = 50;
    let promises = [
      this.gpuContract.callStatic.balanceOf(api.signer.address)
    ]
    if (symbol !== 'GENESIS') {
      promises.push(this.gpuContract.callStatic.supplyCap())
    }
    promises = await Promise.all(promises)
    if (promises.length === 2) cap = promises[1]

    promises = []
    for (var i = 1; i <= Number(cap); i++) {
      promises.push(this.gpuContract.callStatic.ownerOf(i))
    }
    promises = await Promise.allSettled(promises)
    let cards = []
    const tokenIdsToCheck = []
    promises.forEach((result, i) => {
      if (result.status === 'rejected') tokenIdsToCheck.push(i + 1)
      else if(result.value) result.value  === api.signer.address ? cards.push({tokenId: i + 1}) : tokenIdsToCheck.push(i + 1)
    });

    console.log(tokenIdsToCheck);
    promises = []
    for (const i of tokenIdsToCheck) {
      promises.push(this.contract.callStatic.ownerOf(i))
    }
    promises = await Promise.allSettled(promises)
    let miningCards = []
    promises.forEach((result, i) => {
      if(result.value === api.signer.address) cards.push({tokenId: tokenIdsToCheck[i], mining: true})
    });

    cards = cards.sort((a, b) => a.tokenId - b.tokenId)

    this.shadowRoot.querySelector('nft-pool-cards')._load(cards)

    setInterval(async () => {
      this._parseRewards()
    }, 10000);
  }

  async _parseRewards() {
    let earned = await this.contract.callStatic.earned()
    earned = ethers.utils.formatUnits(earned)
    if (Number(earned) < 1000) {
      this.setAttribute('no-rewards', '')
    } else {
      this.removeAttribute('no-rewards')
    }
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
        --svg-icon-color: #d081b6;
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
        pointer-events: auto;
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
      .bottom-toolbar {
        display: flex;
        padding: 0px 24px 12px 24px;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
      }
      .bottom-toolbar button {
        border-radius: 24px;
        height: 40px;
      }
      :host([no-rewards]) button {
        opacity: 0;
        pointer-events: none;
      }
      ${scrollbar}
    </style>

    <section>
      <!-- <custom-svg-icon icon="close" data-route="back"></custom-svg-icon> -->
      <pool-selector-item></pool-selector-item>

    </section>
    <nft-pool-cards></nft-pool-cards>

    <flex-row class="bottom-toolbar">
      <button data-action="getReward">get reward</button>
    </flex-row>
    `
  }
})

import PLATFORM_ABI from './../../../abis/platform.js'
import './nft-pool-cards'
import { scrollbar } from './../styles/shared'
import './pool-selector-item'

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

      // let earned = await this.contract.callStatic.earned(api.signer.address, this.id)
      // earned = ethers.utils.formatUnits(earned)
      // if (Number(earned) >= 1000) {
      const tx = await this.contract.functions.getReward(this.id)
      await tx.wait()
      // }
      return
    }

    if (action === 'activate') {
      const card = this.shadowRoot.querySelector('nft-pool-cards').querySelector(`[data-id="${id}"]`)
      card.setAttribute('mining', 'true')
      card.setAttribute('status', 'starting')
      let mine;
      let approved;
      try {
        card.removeAttribute('stopped')
        card.setAttribute('status', 'booting')
        card.setAttribute('booting', '')
        mine = await this.contract.functions.activateGPU(this.id, id)
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
        mine = await this.contract.functions.deactivateGPU(this.id, id)
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

    if (action === 'activateItem') {
      let promises = []
      const balance = await this.contract.callStatic.balanceOf(api.signer.address, '5')
      if (balance.toNumber() === 0) return

      const totalSupply = await this.contract.callStatic.totalSupply('5')

      for (let i = 1; i <= totalSupply.toNumber(); i++) {
        promises.push(this.contract.callStatic.ownerOf('5', i))
      }
      promises = await Promise.all(promises)
      const available = []
      let i = 0
      for (const addr of promises) {
        i++
        if (addr === api.signer.address) {
          const activated = await this.contract.callStatic.activated('5', i)
          if (activated.toNumber() === 0) available.push(i)
        }
      }
      let tx = await this.contract.functions.activateItem(this.id, '5', available[0])
      await tx.wait()
      return
    }

    if (action === 'activateAll') {

      const cards = this.cards.reduce((prev, card) => {
        if (!card.mining) prev.push(card.tokenId)
        return prev
      }, [])

      for (let id of cards) {
        const card = this.shadowRoot.querySelector('nft-pool-cards').querySelector(`[data-id="${id}"]`)
        card.setAttribute('mining', 'true')
        card.setAttribute('status', 'starting')
        card.removeAttribute('stopped')
        card.setAttribute('status', 'booting')
        card.setAttribute('booting', '')
      }

      const ids = cards.map(card => this.id)
      try {
        let tx = await this.contract.activateGPUBatch(ids, cards)
        await tx.wait()

        for (let id of cards) {
          const card = this.shadowRoot.querySelector('nft-pool-cards').querySelector(`[data-id="${id}"]`)
          card.removeAttribute('booting', '')
          card.setAttribute('status', 'activated')
        }


      } catch (e) {
        card.removeAttribute('stopping')
        card.setAttribute('stopped', '')
        setTimeout(() => {
          card.setAttribute('mining', 'false')
          card.setAttribute('status', 'deactivated')
        }, 1600);
      }
      return
    }

    this.showBuyDialog()


  }

  async _load({symbol, id}) {
    this.shadowRoot.querySelector('nft-pool-cards').innerHTML = ''
    this._id = id
    this.id = id
    this.symbol = symbol

    console.log(id, symbol);

    this.shadowRoot.querySelector('pool-selector-item').setAttribute('symbol', symbol)
    this.shadowRoot.querySelector('pool-selector-item').setAttribute('id', id)
    this.contract = api.getContract(api.addresses.platform, PLATFORM_ABI, true)

    this._parseRewards()
    console.log(this.contract);
    let promises = [
      this.contract.callStatic.balanceOf(api.signer.address, id),
      this.contract.callStatic.totalSupply(id)
    ]
    promises = await Promise.all(promises)

    // if (Number(promises[0]) === 0) return;

    const totalSupply = promises[1]
    promises = []

    for (var i = 1; i <= Number(totalSupply); i++) {
      promises.push(this.contract.callStatic.ownerOf(id, i))
    }
    promises = await Promise.allSettled(promises)
    let cards = []
    const tokenIdsToCheck = []

    for (const result of promises) {
      if (result.status !== 'rejected' && result.value === api.signer.address) {
        const tokenId = promises.indexOf(result) + 1
        const mining = await this.contract.callStatic.mining(this.id, tokenId)

        const bonus = await this.contract.callStatic.bonuses(api.signer.address, this.id, '5')
        if (bonus.toNumber() >= card.length - 1) cards.push({tokenId: tokenId, bonus: true, mining: Boolean(Number(mining) === 1)})
        else cards.push({tokenId: tokenId, bonus: false, mining: Boolean(Number(mining) === 1)})
      }
    }

    cards = cards.sort((a, b) => a.tokenId - b.tokenId)
    this.cards = cards
    this.shadowRoot.querySelector('nft-pool-cards')._load(cards)

    setInterval(async () => {
      this._parseRewards()
    }, 10000);
  }

  async _parseRewards() {
    this.removeAttribute('no-rewards')
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
      button[data-action="activateAll"] {
        border-radius: 24px;
        height: 40px;
      }
      ${scrollbar}
    </style>

    <section>
      <!-- <custom-svg-icon icon="close" data-route="back"></custom-svg-icon> -->
      <pool-selector-item></pool-selector-item>

    </section>
    <nft-pool-cards></nft-pool-cards>

    <flex-row class="bottom-toolbar">
      <flex-one></flex-one>
      <button data-action="getReward">get reward</button>
      <flex-two></flex-two>
      <button data-action="activateItem">upgrade</button>
      <flex-two></flex-two>
      <button data-action="activateAll">activate all</button>
      <flex-one></flex-one>
    </flex-row>


    `
  }
})

import PLATFORM_ABI from './../../../abis/platform.js'
import './nft-wallet-cards'
import { scrollbar } from './../styles/shared'
import './wallet-selector-item'

globalThis._contracts = globalThis._contracts || []

export default customElements.define('wallet-token', class WalletToken extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  set address(value) {
    if (this.address !== value) this._load(value)
  }

  get address() {
    return this._address
  }

  async _load({symbol, id, balance}) {
    this.shadowRoot.querySelector('nft-wallet-cards').innerHTML = ''
    this._id = id
    this.id = id
    this.symbol = symbol

    console.log(id, symbol);

    this.shadowRoot.querySelector('wallet-selector-item').setAttribute('symbol', symbol)
    this.shadowRoot.querySelector('wallet-selector-item').setAttribute('id', id)
    this.shadowRoot.querySelector('wallet-selector-item').setAttribute('balance', balance)
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
        let mining = await this.contract.callStatic.mining(this.id, tokenId)
        if (Number(mining) === 0) mining = await this.contract.callStatic.activated(this.id, tokenId)
        cards.push({tokenId: tokenId, mining: Boolean(Number(mining) === 1)})
      }
    }

    cards = cards.sort((a, b) => a.tokenId - b.tokenId)
    this.cards = cards
    this.shadowRoot.querySelector('nft-wallet-cards')._load(cards)

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

      nft-wallet-cards {
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

      wallet-selector-item {
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
      <wallet-selector-item></wallet-selector-item>

    </section>
    <nft-wallet-cards></nft-wallet-cards>
    `
  }
})

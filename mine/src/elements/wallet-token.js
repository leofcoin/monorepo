import PLATFORM_ABI from './../../../abis/platform.js'
import EXCHANGE_FACTORY_ABI from './../../../abis/exchangeFactory.js'
import {abi as IERC721} from './../../../build/contracts/IERC721.json'
import './nft-wallet-cards'
import { scrollbar } from './../styles/shared'
import './wallet-selector-item'

globalThis._contracts = globalThis._contracts || []

export default customElements.define('wallet-token', class WalletToken extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._click = this._click.bind(this)
    this._onInput = this._onInput.bind(this)
    this._onSend = this._onSend.bind(this)

  }

  set address(value) {
    if (this.address !== value) this._load(value)
  }

  get address() {
    return this._address
  }

  async _load({symbol, id, balance}) {
    this.removeAttribute('sending')
    this.shadowRoot.querySelector('nft-wallet-cards').innerHTML = ''
    this._id = id
    this.id = id
    this.symbol = symbol

    this.shadowRoot.querySelector('wallet-selector-item').setAttribute('symbol', symbol)
    this.shadowRoot.querySelector('wallet-selector-item').setAttribute('id', id)
    this.shadowRoot.querySelector('wallet-selector-item').setAttribute('balance', balance)
    this.contract = api.getContract(api.addresses.platform, PLATFORM_ABI, true)
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
        let mining = await api.mining.contract.callStatic.mining(this.id, tokenId)
        if (Number(mining) === 0 && this.id === '5') mining = await api.mining.contract.callStatic.activated(this.id, tokenId)
        cards.push({tokenId: tokenId, mining: Boolean(Number(mining) === 1), token: this.id})
      }
    }

    cards = cards.sort((a, b) => a.tokenId - b.tokenId)
    this.cards = cards
    this.shadowRoot.querySelector('nft-wallet-cards')._load(cards)
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this._click)
  }

  async _click(event) {
    const target = event.composedPath()[0]
    console.log(target);
    if (this.hasAttribute('sending')) {
      if (target.getAttribute('icon') === 'arrow-drop-up') {
        this._reset()
      }
      return
    }

    if (target.dataset.action === 'dropdown') {
      this._el = document.createElement('flex-column')
      this._el.innerHTML = `
      <flex-row style="width:100%; padding-bottom: 12px; height: 40px;">
        <custom-input style="background: rgba(0,0,0,0.2); min-width: 0; width: 338px; border-radius: 12px;" name="send" placeholder="receiver address"></custom-input>
        <flex-one></flex-one>
        <button name="send" disabled>send</button>
      </flex-row>

      <flex-row style="width: 100%; height: 40px;">
        <custom-input style="background: rgba(0,0,0,0.2); min-width: 0; width: 338px; border-radius: 12px; margin-right: 12px;" name="currency" placeholder="currency to receive (0x0 for BNB)"></custom-input>
        <custom-input style="background: rgba(0,0,0,0.2); min-width: 0; border-radius: 12px; width: 86px;" placeholder="price" name="price" style="min-width: 0;"></custom-input>
        <flex-one></flex-one>
        <button name="list" disabled>list</button>
      </flex-row>
      `

      this._el.classList.add('sending')
      target.setAttribute('icon', 'arrow-drop-up')
      this._el.style = 'width: calc(100% - 36px); background: rgba(0,0,0,0.2); justify-content: center; border-radius: 12px; padding: 12px; box-sizing: border-box;'
      target.parentNode.host.after(this._el)
      this.setAttribute('sending', target.getAttribute('token-id'))
      this.shadowRoot.querySelector('custom-input[name="send"]').addEventListener('input', this._onInput)
      this.shadowRoot.querySelector('custom-input[name="price"]').addEventListener('input', this._onInput)
      this.shadowRoot.querySelector('custom-input[name="currency"]').addEventListener('input', this._onInput)
      this._el.querySelector('button[name="send"]').addEventListener('click', this._onSend)
      this._el.querySelector('button[name="list"]').addEventListener('click', this._onList)
    }
    if (target.name === 'send') {
      const id = this.id
      const tokenId = this.getAttribute('sending')
      this.contract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, api.signer)
      const to = this.shadowRoot.querySelector('custom-input').input.value
      const tx = await this.contract.safeTransferFrom(
        api.signer.address,
        to,
        ethers.BigNumber.from(id),
        ethers.BigNumber.from(tokenId),
        "0x"
      )
      await tx.wait()
      this._reset(target.parentElement.parentElement.previousElementSibling.shadowRoot.querySelector('[icon="arrow-drop-up"]'))
    }

    if (target.name === 'list') {
      const address = api.addresses.platform
      const id = ethers.BigNumber.from(this.id)
      const tokenId = ethers.BigNumber.from(this.getAttribute('sending'))
      this.contract = new ethers.Contract(api.addresses.exchangeFactory, EXCHANGE_FACTORY_ABI, api.signer)
      const currency = this.shadowRoot.querySelector('custom-input[name="currency"]').input.value
      const price = this.shadowRoot.querySelector('custom-input[name="price"]').input.value
      let listing = await this.contract.callStatic.getListingERC1155(address, id, ethers.BigNumber.from(tokenId))
      if (listing === '0x0000000000000000000000000000000000000000') listing = await this.contract.callStatic.getListing(address, id)
      await this._approve(address)
      let tx;
      if (listing !== '0x0000000000000000000000000000000000000000') {
        tx = await this.contract.relist(
          address,
          id,
          tokenId,
          ethers.utils.parseUnits(price, 18),
          this._getCurrency(currency)
        )
      } else {
        tx = await this.contract.createListing(
          address,
          this._getCurrency(currency),
          ethers.utils.parseUnits(price, 18),
          id,
          tokenId
        )
      }

      await tx.wait()
      this._reset(target.parentElement.parentElement.previousElementSibling.shadowRoot.querySelector('[icon="arrow-drop-up"]'))
    }

  }

  async _approve(address) {
    const contract = new ethers.Contract(address, IERC721, api.signer)
    const approved = await contract.callStatic.isApprovedForAll(api.signer.address, api.addresses.exchangeFactory)
    if (!approved) {
      try {
        const tx = await contract.setApprovalForAll(api.addresses.exchangeFactory, true)
        await tx.wait()
      } catch (e) {
        alert(e)
      }
    }
    return
  }

  _getCurrency(currency) {
    return currency === '0x0' ? '0x0000000000000000000000000000000000000000' : currency
  }

  async _onSend(event) {


  }

  async _onSend(event) {

    const id = this.id
    const tokenId = this.getAttribute('sending')
    this.contract = new ethers.Contract(api.addresses.platform, PLATFORM_ABI, api.signer)
    const to = this.shadowRoot.querySelector('custom-input').input.value
    const tx = await this.contract.safeTransferFrom(
      api.signer.address,
      to,
      ethers.BigNumber.from(id),
      ethers.BigNumber.from(tokenId),
      "0x"
    )
    await tx.wait()
    this._reset()
  }

  _reset(target) {
    target && target.setAttribute('icon', 'arrow-drop-down')
    this.setAttribute('disabled', '')
    this.removeAttribute('sending')
    const child = this.shadowRoot.querySelector('nft-wallet-cards').querySelector('.sending')
    child && this.shadowRoot.querySelector('nft-wallet-cards').removeChild(child)
  }

  _onInput(event) {

      const target = event.composedPath()[0]
      const name = target.getAttribute('name')

    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      const buttonQuery = `button[name="${name === 'price' || name === 'currency' ? 'list' : 'send'}"]`
      const button = this.shadowRoot.querySelector(buttonQuery)

      let value = this.shadowRoot.querySelector(`custom-input[name="${name}"]`).input.value
      if (value === '0x0') value = '0x0000000000000000000000000000000000000000'
      let currency = this.shadowRoot.querySelector(`custom-input[name="currency"]`).input.value
      if (currency === '0x0') currency = '0x0000000000000000000000000000000000000000'
      if (name === 'send' && api.isEthereumAddress(value)) button.removeAttribute('disabled')
      else if (name === 'currency' && api.isEthereumAddress(value) && this.shadowRoot.querySelector(`custom-input[name="price"]`).input.value) button.removeAttribute('disabled')
      else if (name === 'price' && api.isEthereumAddress(currency)) button.removeAttribute('disabled')
      else button.setAttribute('disabled', '')
    }, 200)
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

      [disabled] {
        color: #444;
        border-color: #444;
        pointer-events: none;
      }

      custom-input {
        --custom-input-color: #d081b6;
        box-shadow: none;
        height: 40px;
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
        border-radius: 12px;
        height: 40px;
        min-width: 82px;
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
      <wallet-selector-item></wallet-selector-item>

    </section>
    <nft-wallet-cards></nft-wallet-cards>
    `
  }
})

import { elevation2dp } from './../styles/elevation'
import ABI from './../../../abis/presale'
export default customElements.define('buy-arteon-view', class BuyArteonView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template

    this._onvalue = this._onvalue.bind(this)
    this._swap = this._swap.bind(this)
  }

  connectedCallback() {
    this.shadowRoot.querySelector('custom-input').addEventListener('input', this._onvalue)
    this.shadowRoot.querySelector('button').addEventListener('click', this._swap)
  }

  async _getPrice(amount) {
    const response = await fetch(`https://bsc.api.0x.org/swap/v1/price?buyAmount=${ethers.utils.parseUnits(amount, 18)}&buyToken=${api.addresses.artonline}&sellToken=BNB`)
    const price = await response.json()
    console.log(price);
    const protocol = price.sources.filter(protocol => protocol.proportion === '1')[0]
    console.log(protocol);
    this.shadowRoot.querySelector('.price').innerHTML = `
    <span style="height: 40px;padding: 12px 0; box-sizing: border-box;">${protocol.name}</span>
    <flex-one></flex-one>
    <span style="height: 40px;padding: 12px 0; box-sizing: border-box;">1 ETH = ${Math.round(Number(price.buyTokenToEthRate))}</span>`

    this.shadowRoot.querySelector('button').innerHTML = `BUY ${amount} ART FOR ${ethers.utils.formatUnits(price.sellAmount, 18)} ETH`
    // console.log(ethers.utils.parseUnits(quote.price, 18).toString())
  }

  async _swap() {
    const amount = this.shadowRoot.querySelector('custom-input').value
    // const value = Number(amount) / 43478
    // this.contract = new ethers.Contract(api.addresses.presale, ABI, api.signer)
    // this.contract.buyTokens(api.address, {value})
    const response = await fetch(`https://bsc.api.0x.org/swap/v1/quote?buyAmount=${ethers.utils.parseUnits(amount, 18)}&buyToken=${api.addresses.artonline}&sellToken=BNB`)
    const quote = await response.json()
    const tx = await api.signer.sendTransaction({
      to: quote.to,
      value: ethers.BigNumber.from(quote.value),
      data: quote.data
    })
    await tx.wait()
  }

  _onvalue() {
    this._timeout && clearTimeout(this._timeout)

    this._timeout = () => setTimeout(() => {
      const input = this.shadowRoot.querySelector('custom-input')
      this.shadowRoot.querySelector('button').innerHTML = `BUY ${input.value} ART FOR ${Number(input.value) / 43478} BNB`
      this._getPrice(this.shadowRoot.querySelector('custom-input').value)
    }, 200);

    this._timeout()
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        color: var(--main-color);
      }

      .hero {
        display: flex;
        flex-direction: column;
        max-width: 420px;
        max-height: 420px;
        min-height: 158px;
        width: 100%;
        padding: 24px;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        z-index: 1;
        position: relative;
        border-radius: 24px;
        background: var(--custom-drawer-background);
        ${elevation2dp}
      }

      .logo {
        height: 32px;
        width: 32px;
      }

      strong {
        font-size: 22px;
      }

      custom-input {
        box-shadow: none;
        pointer-events: auto;
        --custom-input-placeholder-color: var(--main-color);
        --custom-input-color: var(--main-color);
      }

      .input {
        box-sizing: border-box;
        padding: 0 12px;
        border-radius: 24px;
        align-items: center;
        ${elevation2dp}
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
        height: 40px;
        cursor: pointer;
        pointer-events: auto;
      }
      strong {
        padding: 0 6px;
      }

      [icon="swap-horiz"] {
        --svg-icon-color: var(--main-color);
        transform: rotate(90deg);
      }
      .spacing {
        display: flex;
        padding: 12px 0 0 0;
      }

      .sell {
        --custom-input-placeholder-color: #333;
        pointer-events: none;
      }

      flex-row {
        width: 100%;
      }

      .price {
        box-sizing: border-box;
        padding: 0 24px;
      }

      button {
        margin-top: 24px;
        text-transform: uppercase;
      }
    </style>

    <span class="hero">
      <flex-row class="input">
        <custom-input placeholder="amount"></custom-input>
        <flex-row>
          <img class="logo" src="./assets/arteon.svg"></img>
          <strong>ART</strong>
        </flex-row>
      </flex-row>
      <!--  <span class="spacing"></span>
      <custom-svg-icon icon="swap-horiz"></custom-svg-icon>
      <span class="spacing"></span>
    <flex-row class="input">
        <custom-input placeholder="amount" class="sell"></custom-input>
        <flex-row>
          <img class="logo" src="https://raw.githubusercontent.com/CoinsSwap/token-list/main/build/icons/color/eth.svg"></img>
          <strong>ETH</strong>
        </flex-row>
      </flex-row>
      -->

      <flex-row class="price">
      </flex-row>
      <flex-one></flex-one>
      <button>enter amount</button>
    </span>

    `

    // <flex-row style="width:100%;"><strong>dex</strong><flex-one></flex-one><pubsub-text event="swap.dex"></pubsub-text></flex-row>
  }
})

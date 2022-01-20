import './../animations/loading'
import './../elements/wallet-token-item'
import { abi as IERC20_ABI } from './../../../build/contracts/IERC20.json'

export default customElements.define('wallet-view', class WalletView extends BaseClass {
  constructor() {
    super()
  }

  connectedCallback() {
    this._init()
  }

  async _init() {
    await isApiReady()
    if (!api.connection) {
      await api.connectWallet()
    }
    console.log(api.connection);
    const items = []
    for (const key of Object.keys(globalThis.tokenList.tokens)) {
      const {name, symbol, address, icon, decimals} = globalThis.tokenList.tokens[key]
      const contract = new ethers.Contract(address, IERC20_ABI, api.connection.provider)
      const balance = await contract.balanceOf(api.connection.accounts[0])
      items.push({name, symbol, icon: icon['color'] || icon, address, balance: ethers.utils.formatUnits(balance)})
    }

    this.sqs('array-repeat').items = items
  }

  get template() {
    return html`
    <style>
      :host {
        width: 100%;
        height: 100%;
        color: var(--main-color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
      }

      flex-column {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        align-items: baseline;
      }

      array-repeat {
        max-width: 640px;
        width: 100%;
        box-shadow: 1px 1px 13px 5px var(--accent-color);
      }

      [slot="content"] {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
    </style>
    <array-repeat>
      <template>
        <wallet-token-item balance="[[item.balance]]" symbol="[[item.symbol]]" icon="[[item.icon]]"></wallet-token-item>
      </template>
    </array-repeat>
    `
  }
})

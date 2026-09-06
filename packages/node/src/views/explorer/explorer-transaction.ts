import { css, html, LitElement } from 'lit'
import {map} from 'lit/directives/map.js'
import '../../elements/latest.js'
import '../../elements/explorer/info-container.js'
import { formatBytes } from '@leofcoin/utils'
import '../../elements/time/ago.js'
import {TransactionMessage} from '@leofcoin/messages'
import '../../animations/busy.js'
import '../../elements/explorer/property-info.js'
export default customElements.define('explorer-transaction', class ExplorerTransaction extends LitElement {
  static styles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 48px;
    align-items: center;
    box-sizing: border-box;
  }

  flex-row {
    width: 100%;
    align-items: center;
    justify-content: center;
  }

  flex-column {
    max-width: 720px;
    max-height: 600px;
    width: 100%;
    height: 100%;
  }

  .container {
    padding: 12px;
    box-sizing: border-box;
    border-radius: 24px;
    overflow-y: auto;
  }

  .container h4 {
    padding-left: 12px;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    -webkit-box-shadow: inset 0 0 6px rgb(73 78 112);
    border-radius: 10px;
    margin: 12px 0;
  }
  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 6px rgba(225,255,255,0.5);
  }
  h4 {
    margin: 0;
    padding: 6px 0;
  }

  time-ago {
    padding-right: 12px;
  }

  .info-item {
    padding: 6px;
    box-sizing: border-box;
  }
  `
  static properties = {
    transaction: {
      type: Object
    },
    size: {
      type: Number
    },
    transactionHashes: {
      type: Array
    }
  }

  constructor() {
    super()
  }

  async updateInfo(index, transactionIndex) {
    console.log(index);
    const block = await client.getBlock(index)
    console.log(block);
    const transaction = block.transactions[transactionIndex]
    this.size = new TextEncoder().encode(JSON.stringify(transaction)).byteLength

    const hash = await (await new TransactionMessage(transaction)).hash()
    this.transaction = {hash, ...transaction}
  }

  render() {
    if (!this.transaction) return html`
    <busy-animation></busy-animation>
    `
    return html`

<flex-column class="container">

  <property-info>
    <h4>hash</h4>
    <flex-it></flex-it>
    <very-short-string value=${this.transaction.hash}></very-short-string>
  </property-info>

  <property-info>
    <h4>from</h4>
    <flex-it></flex-it>

    <span>${this.transaction.from}</span>
  </property-info>

  <property-info>
    <h4>to</h4>
    <flex-it></flex-it>

    <span>${this.transaction.to}</span>
  </property-info>

  <property-info>
    <h4>method</h4>
    <flex-it></flex-it>

    <span>${this.transaction.method}</span>
  </property-info>

  <property-info>
    <flex-column>
      <h4>params</h4>
      ${map(this.transaction.params, param => html`<param-element address="${param}" style="padding-left: 12px;">${param}</param-element>`)}
    </flex-column>
  </property-info>
  <!-- <property-info>
    <h4>height</h4>
    <flex-it></flex-it>
    <span>${this.transaction.index + 1}</span>
  </property-info> -->

  <property-info>
    <h4>timestamp</h4>
    <flex-it></flex-it>
    <time-ago value=${this.transaction.timestamp}></time-ago>
    <span>${new Date(this.transaction.timestamp).toLocaleString()}</span>
  </property-info>

  <property-info>
    <h4>fees</h4>
    <flex-it></flex-it>

    <span>${this.transaction.fee}</span>
  </property-info>

  <property-info>
    <h4>size</h4>
    <flex-it></flex-it>

    <span>${formatBytes(Number(this.size))}</span>
  </property-info>
</flex-column>
`
  }
})

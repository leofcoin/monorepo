import { html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import '../../elements/latest.js'
import '../../elements/explorer/info-container.js'
import { formatBytes } from '@leofcoin/utils'
import { TransactionMessage } from '@leofcoin/messages'

export default customElements.define(
  'explorer-block-transactions',
  class ExplorerBlockTransactions extends LiteElement {
    @property({ type: Array }) accessor transactions
    static properties = {
      transactions: {
        type: Array
      }
    }

    async updateInfo(hash, index) {
      const block = await client.getBlock(index)
      const transactions = []
      let i = 0
      for (const transaction of block.transactions) {
        const hash = await (await new TransactionMessage(transaction)).hash()
        transactions.push({ hash, ...transaction, index: i, blockIndex: index })
        i++
      }
      this.transactions = transactions
    }

    #goBack() {
      location.hash = `#!/explorer?selected=transactions`
    }

    render() {
      return html`
        <style>
          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow-y: auto;
          }

          .latest-transactions {
            width: 100%;
            height: 100%;
            box-sizing: border-box;

            overflow-y: auto;
          }

          .container {
            box-sizing: border-box;
            border-radius: 24px;
            width: 100%;
            height: 100%;
            padding: 12px;
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
            -webkit-box-shadow: inset 0 0 6px rgba(225, 255, 255, 0.5);
          }
          @media (min-width: 640px) {
            :host {
              align-items: center;
              justify-content: center;
              padding: 12px;
            }

            .container {
              max-width: 600px;
              max-height: 600px;
              border-radius: 24px;
              padding: 12px 0;
            }
          }
        </style>

        <hero-element>
          <flex-column class="latest-transactions">
            ${map(
              this.transactions,
              (item) => html` <latest-element value=${JSON.stringify(item)} type="transaction"></latest-element> `
            )}
          </flex-column>
        </hero-element>
      `
    }
  }
)

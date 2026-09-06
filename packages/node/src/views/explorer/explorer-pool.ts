import { html, LitElement } from 'lit'
import { map } from 'lit/directives/map.js'
import '../../elements/latest.js'
import '../../elements/explorer/info-container.js'
import { formatBytes } from '@leofcoin/utils'

export default customElements.define(
  'explorer-pool-transactions',
  class ExplorerPoolTransactions extends LitElement {
    #blocks

    static properties = {
      items: {
        type: Array
      }
    }
    #transactions = []

    #addBlock(block) {
      console.log(block)
      if (block.transactions.length > 25) {
        this.#transactions = block.transactions.slice(-25)
      } else {
        this.#transactions = [...block.transactions, ...this.#transactions.slice(-(block.transactions.length - 1))]
      }

      this.requestUpdate()
    }

    #goBack() {
      location.hash = `#!/explorer?selected=transactions`
    }

    async connectedCallback() {
      super.connectedCallback()
      this.#blocks = (await client.blocks(-25)).reverse()
      console.log(this.#blocks)
      let i = 0
      while (this.#transactions.length < 25 && this.#blocks.length - 1 >= i) {
        console.log(this.#blocks[i])
        if (this.#blocks[i].transactions.length < 25)
          this.#blocks[i].transactions.slice(0, this.#blocks[i].transactions.length - 1)
        this.#transactions = [...this.#transactions, ...this.#blocks[i].transactions.slice(-25)]
        i++
      }

      this.requestUpdate()

      client.pubsub.subscribe('add-block', this.#addBlock.bind(this))
      client.pubsub.subscribe('block-processed', this.#addBlock.bind(this))
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
        <flex-column class="container">
          <flex-column class="latest-transactions">
            ${map(
              this.#transactions,
              (item) => html` <latest-element value=${JSON.stringify(item)} type="transaction"></latest-element> `
            )}
          </flex-column>
        </flex-column>
      `
    }
  }
)

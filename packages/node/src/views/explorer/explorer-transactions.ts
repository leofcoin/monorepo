import { html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import '../../elements/latest.js'
import '../../elements/explorer/info-container.js'
import { formatBytes } from '@leofcoin/utils'
import { TransactionMessage } from '@leofcoin/messages'

export default customElements.define(
  'explorer-transactions',
  class ExplorerTransactions extends LiteElement {
    @property({ consumes: true }) accessor blocks
    transactions = []

    #addBlock(block) {
      console.log(block)
      if (block.transactions.length > 25) {
        this.transactions = block.transactions.slice(-25)
      } else {
        this.transactions = [...block.transactions, ...this.transactions.slice(-(block.transactions.length - 1))]
      }

      this.requestRender()
    }

    #goBack() {
      location.hash = `#!/explorer?selected=transactions`
    }

    onlyTwentyFiveTransactions(blocks) {
      const transactions = []
      for (let i = 0; i < blocks.length; i++) {
        if (transactions.length >= 25) return transactions

        const remaining = 25 - transactions.length
        transactions.push(
          ...blocks[i].transactions.slice(-remaining).map((tx) => ({ hash: tx, blockIndex: blocks[i].index }))
        )
      }
      return transactions
    }

    async onChange(propertyKey: string, value: any): Promise<void> {
      if (propertyKey === 'blocks') {
        console.log('blocks changed', value)
        console.log(this.blocks)

        this.transactions = this.onlyTwentyFiveTransactions(value)
        console.log({ transactions: this.transactions })
        this.transactions = await Promise.all(
          this.transactions.map(async ({ hash, blockIndex }) => {
            console.log('fetching transaction', hash)

            const tx = await globalThis.transactionStore.get(hash)
            return { ...new TransactionMessage(tx).decode(), hash, blockIndex, blockHash: value[blockIndex].hash }
          })
        )

        console.log({ transactions: this.transactions })

        this.requestRender()
      }
    }

    async connectedCallback() {
      super.connectedCallback()
      // this.#blocks = (await client.blocks(-25)).reverse()
      // console.log(this.#blocks)
      // let i = 0
      // while (this.#transactions.length < 25 && this.#blocks.length - 1 >= i) {
      //   console.log(this.#blocks[i])
      //   if (this.#blocks[i].transactions.length < 25)
      //     this.#blocks[i].transactions.slice(0, this.#blocks[i].transactions.length - 1)
      //   this.#transactions = [...this.#transactions, ...this.#blocks[i].transactions.slice(-25)]
      //   i++
      // }

      // this.requestRender()

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
            padding: 12px;
            box-sizing: border-box;
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
              this.transactions,
              (item) => html` <latest-element .value=${item} type="transaction"></latest-element> `
            )}
          </flex-column>
        </flex-column>
      `
    }
  }
)

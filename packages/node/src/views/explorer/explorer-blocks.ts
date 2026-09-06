import { html, LiteElement, customElement, property, map } from '@vandeurenglenn/lite'
import '../../elements/latest.js'

@customElement('explorer-blocks')
export class ExplorerBlocks extends LiteElement {
  @property({ consumes: true }) accessor blocks

  #addBlock = (block) => {
    console.log({ 'added-block': block })
    this.blocks.push(block)
  }

  firstRender(): void {
    client.pubsub.subscribe('add-block', this.#addBlock)
    client.pubsub.subscribe('block-processed', this.#addBlock)
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
          box-sizing: border-box;
          padding: 12px;
          box-sizing: border-box;
        }

        .container {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }

        .latest-blocks {
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }

        latest-element {
          padding: 12px;
          box-sizing: border-box;
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
          -webkit-box-shadow: inset 0 0 6px rgba(225, 255, 255, 0.5);
        }

        h4 {
          margin: 0;
          padding: 6px 0;
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
        <flex-column class="latest-blocks">
          ${this.blocks
            ? map(this.blocks, (item) => html` <latest-element .value=${item} type="block"></latest-element> `)
            : ''}
        </flex-column>
      </flex-column>
    `
  }
}

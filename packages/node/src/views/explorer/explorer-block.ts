import { css, html, LiteElement, customElement, property } from '@vandeurenglenn/lite'
import type { StyleList } from '@vandeurenglenn/lite/element'
import '../../elements/latest.js'
import '../../elements/explorer/info-container.js'
import { formatBytes, formatUnits, jsonStringifyBigInt } from '@leofcoin/utils'
import '../../elements/time/ago.js'
import '../../animations/busy.js'
import '../../elements/shorten-string.js'
import '../../elements/explorer/property-info.js'
import { BlockMessage } from '@leofcoin/messages'

@customElement('explorer-block')
export class ExplorerBlock extends LiteElement {
  @property({ type: Object })
  accessor block

  @property({ type: String }) accessor selected: string

  @property()
  accessor size: number

  @property()
  accessor transactionHashes: []

  #goBack() {
    location.hash = `#!/explorer?selected=blocks`
  }

  #goTransactions() {
    location.hash = `#!/explorer?blockTransactions=${this.block.hash}&index=${this.block.index}`
  }

  async onChange(propertyKey: string, value: any): Promise<void> {
    if (propertyKey === 'selected') {
      console.log(value)

      const block = await globalThis.peernet.get(value)
      this.block = new BlockMessage(block).decode()
    }
  }

  render() {
    console.log(this.block)

    if (!this.block) {
      return html` <busy-animation></busy-animation> `
    }

    return html`
      <flex-row class="back-container">
        <custom-svg-icon icon="chevron-left" @click="${this.#goBack}"></custom-svg-icon>
        <strong>back</strong>
        <flex-it></flex-it>
      </flex-row>

      <flex-column class="container">
        <property-info>
          <h4>hash</h4>
          <flex-it></flex-it>
          <shorten-string value=${this.block.hash}></shorten-string>
        </property-info>

        <property-info>
          <h4>index</h4>
          <flex-it></flex-it>
          <span>${this.block.index}</span>
        </property-info>

        <property-info>
          <h4>timestamp</h4>
          <flex-it></flex-it>
          <time-ago value=${this.block.timestamp}></time-ago>
          <span>${new Date(this.block.timestamp).toLocaleString()}</span>
        </property-info>

        <property-info>
          <h4>fees</h4>
          <flex-it></flex-it>

          <span>${formatUnits(this.block.fees)}</span>
        </property-info>
        <property-info>
          <h4>reward</h4>
          <flex-it></flex-it>

          <span>${formatUnits(this.block.reward)}</span>
          <strong style="margin-left: 12px;">LFC</strong>
        </property-info>

        <property-info>
          <h4>size</h4>
          <flex-it></flex-it>

          <span
            >${formatBytes(
              Number(new TextEncoder().encode(JSON.stringify(this.block, jsonStringifyBigInt)).byteLength)
            )}</span
          >
        </property-info>

        <property-info>
          <h4>fees burnt</h4>
          <flex-it></flex-it>

          <span>${formatUnits(this.block.fees)}</span>
        </property-info>

        <property-info>
          <h4>rewards minted</h4>
          <flex-it></flex-it>

          <span>${formatUnits(this.block.reward)}</span>
        </property-info>

        <property-info class="selector" @click="${this.#goTransactions}">
          <h4>transactions</h4>
          <flex-it></flex-it>
          <span>${this.block.transactions.length}</span>
          <custom-svg-icon icon="chevron-right"></custom-svg-icon>
        </property-info>

        <property-info>
          <h4>validators</h4>
          <flex-it></flex-it>

          <span>${this.block.validators.length}</span>
        </property-info>

        <flex-column style="padding-left: 24px; box-sizing: border-box;">
          ${this.block.validators.map(
            (validator) =>
              html`<a href="#!/explorer/address=${validator.address}"
                ><shorten-string value=${validator.address}></shorten-string
              ></a>`
          )}
        </flex-column>
      </flex-column>
    `
  }

  static styles: StyleList = [
    css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    align-items: center;
    box-sizing: border-box;
    color: var(--font-color);
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
    border: 1px solid var(--border-color);
    border-radius: 24px;
    margin-bottom: 6px;
    background: var(--secondary-background);
  }

  property-info.selector {
    cursor: pointer;
  }

  @media(min-width: 640px) {
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

    .back-container {
      max-width: 600px;
      max-height: 600px;
      border-radius: 24px;
      padding: 12px 24px;
      box-sizing: border-box;
    }
  `
  ]
}

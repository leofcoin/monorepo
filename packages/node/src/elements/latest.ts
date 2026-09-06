import { formatUnits } from '@leofcoin/utils'
import { LiteElement, html, property, map, customElement } from '@vandeurenglenn/lite'
import './time/ago.js'

@customElement('latest-element')
export class LatestElement extends LiteElement {
  @property({ type: Array }) accessor value
  @property({ type: String }) accessor type: string

  firstRender(): void {
    this.addListener('click', this.#click.bind(this))
  }

  #click() {
    if (this.type === 'block')
      location.hash = `#!/explorer/${this.type}?selected=${this.value.hash}&index=${this.value.index}`
    if (this.type === 'transaction')
      location.hash = `#!/explorer/${this.type}?selected=${this.value.hash}&blockIndex=${this.value.blockIndex}`
  }

  get #blockTemplate() {
    if (!this.value) return
    let total = BigInt(0)

    for (const tx of this.value.transactions) {
      if (tx.method === 'mint') total += BigInt(tx.params[1])
      if (tx.method === 'burn') total += BigInt(tx.params[1])
      if (tx.method === 'transfer') total += BigInt(tx.params[2])
    }

    total = formatUnits(total).toLocaleString()
    return html`
      <flex-column class="first-column">
        <a class="height">${Number(this.value.index) + 1}</a>
        <time-ago value=${this.value.timestamp}></time-ago>
      </flex-column>

      <flex-row class="last-row">
        <flex-column style="min-width: 66%;">
          <flex-row>
            <strong class="transactions" style="padding-right: 4px;">${this.value.transactions.length}</strong>
            <span>${this.value.transactions.length > 1 ? ' transactions' : ' transaction'}</span>
          </flex-row>

          <span class="validators">
            ${map(
              this.value.validators,
              (item: any) => html`
                <strong>${this.value.validators.length}</strong>
                <span>${this.value.validators.length > 1 ? 'validators' : 'validator'}</span>
                <a href="#!/explorer/account?address=${item.address}" class="validator">${item.address.slice(-7)}</a>
              `
            )}
          </span>
        </flex-column>
      </flex-row>

      <div class="total"><span>${total}</span></div>
      <!-- <strong>amount</strong> -->
    `
  }

  get #transactionTemplate() {
    if (!this.value) return
    let amount = 0

    if (this.value.method === 'transfer') amount = this.value.params[2]
    else if (this.value.method === 'mint' || this.value.method === 'burn') {
      amount = this.value.params[1]
    }
    amount = formatUnits(amount).toLocaleString()
    return html`
      <flex-column class="first-column">
        <a class="height">${Number(this.value.blockIndex) + 1}</a>
        <time-ago value=${this.value.timestamp}></time-ago>
      </flex-column>
      <flex-row class="last-row">
        <flex-column style="min-width: 66%;">
          <flex-row>
            <span class="transactions" style="padding-right: 4px;">from </span>
            <strong>${this.value.from.slice(0, 8)}...${this.value.from.slice(-8)}</strong>
          </flex-row>

          <flex-row>
            <span class="transactions" style="padding-right: 4px;">to </span>
            <strong>${this.value.to.slice(0, 8)}...${this.value.to.slice(-8)}</strong>
          </flex-row>
        </flex-column>
      </flex-row>
      <div class="total"><span>${amount}</span></div>
      <!-- <strong>amount</strong> -->
    `
  }

  render() {
    return html`
      <style>
        * {
          pointer-events: none;
        }
        :host {
          display: flex;
          flex-direction: row;
          padding: 12px;
          box-sizing: border-box;
          cursor: pointer;
          pointer-events: auto !important;
          width: 100%;
          height: 56px;
          margin-bottom: 6px;
          align-items: center;
          border: 1px solid var(--border-color);

          color: var(--font-color);
          background: var(--secondary-background);

          border-radius: 24px;
          align-items: space-between;
          background: var(--md-sys-color-inverse-on-surface);
          color: var(--md-sys-color-on-surface);
        }

        flex-row {
          width: 100%;
        }

        .last-row {
          height: 100%;
          max-width: 88%;
          width: 100%;
          align-items: center;
        }

        .first-column {
          width: 100%;
          max-width: 146px;
          padding-right: 20px;
        }

        a {
          color: var(--link-color);
          text-decoration: none;
        }

        .total {
          /* text-overflow: ellipsis;
    overflow: hidden; */
          background: #7986cb;
          color: #fff;
          padding: 6px 12px;
          box-sizing: border-box;
          border-radius: 24px;
          width: fit-content;
        }

        .total span {
          font-weight: 500;
          font-size: 14px;
          text-align: center;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      </style>
      ${this.type === 'block' ? this.#blockTemplate : this.#transactionTemplate}
    `
  }
}

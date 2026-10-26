import { css, html, LiteElement, property } from '@vandeurenglenn/lite'
import { formatUnits } from '@leofcoin/utils'
import { state } from '../state/state.js'

export class AddressAmount extends LiteElement {
  @property({ type: String, reflect: true }) accessor address
  @property({ type: String, reflect: true }) accessor amount = '—'
  connectedCallback() {
    super.connectedCallback()
    globalThis.pubsub.subscribe('block-processed', this.#updateAmount)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    globalThis.pubsub.unsubscribe('block-processed', this.#updateAmount)
  }

  onChange(propertyKey: string, value: any): void {
    propertyKey === 'address' && value !== undefined && this.#updateAmount()
  }

  #updateAmount = async () => {
    console.log(state)

    await state.ready
    console.log(state)
    console.log(chain)

    let amount
    try {
      // todo amount should update dynamically
      amount = await chain.balanceOf(this.address)
      console.log({ amount })
    } catch (error) {
      console.error('Error fetching balance, falling back to remote:', error)
      try {
        amount = await globalThis.client.balanceOf(this.address, false)
      } catch (error) {
        console.error('Error fetching balance:', error)
      }
    }
    this.amount = amount === undefined ? 'Unavailable' : formatUnits(BigInt(amount ?? 0n))
  }

  static styles = [
    css`
      :host {
        display: flex;
        box-sizing: border-box;
        text-overflow: ellipsis;
        overflow: hidden;
        background: var(--md-sys-color-secondary-container, #433b42);
        color: var(--md-sys-color-on-secondary-container, #f4ddea);
        box-sizing: border-box;
        border-radius: 24px;
        padding: 6px 12px;
      }
      p {
        margin: 0;
        font-size: var(--address-amount-font-size, 14px);
        font-weight: var(--address-amount-font-weight, 500);
        text-align: var(--address-amount-align, center);
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        direction: rtl;
        max-width: var(--address-amount-max-width, 86px);
        min-width: var(--address-amount-min-width, 60px);
      }
    `
  ]

  render() {
    return html`<p>${this.amount}</p> `
  }
}

customElements.define('address-amount', AddressAmount)

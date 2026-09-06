import { css, html, LiteElement, property } from '@vandeurenglenn/lite'
import { formatUnits } from '@leofcoin/utils'
import { state } from '../state/state.js'

export class AddressAmount extends LiteElement {
  @property({ type: String, reflect: true }) accessor address
  @property({ type: String, reflect: true }) accessor amount

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
    this.amount = formatUnits(BigInt(amount)).toLocaleString()
  }

  static styles = [
    css`
      :host {
        display: flex;
        box-sizing: border-box;
        text-overflow: ellipsis;
        overflow: hidden;
        background: #7986cb;
        color: #fff;
        box-sizing: border-box;
        border-radius: 24px;
        padding: 6px 12px;
      }
      p {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        direction: rtl;
        max-width: 86px;
        min-width: 60px;
      }
    `
  ]

  render() {
    return html`<p>${this.amount}</p> `
  }
}

customElements.define('address-amount', AddressAmount)

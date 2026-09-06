import { LitElement, PropertyValueMap, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { property } from 'lit/decorators.js'
import type { Address } from '../context/wallet.js'

declare type Validators = {
  [index: Address]: {
    firstSeen: EpochTimeStamp
    lastSeen: EpochTimeStamp
    active: boolean
  }
}

@customElement('validator-view')
export class ValidatorView extends LitElement {
  @property({ type: Object })
  accessor validators: Validators = {}

  @property({ type: Array })
  accessor onlineValidators = []

  async connectedCallback() {
    super.connectedCallback()
    const result = await client.lookup('LeofcoinValidators')
    console.log({ result })

    this.validators = await client.staticCall(result.address, 'validators', [])
    console.log(this.validators)

    if (this.validators[await client.selectedAccount()]) {
      await client.participate(await client.selectedAccount())
    }
    // this.shadowRoot.querySelector('.total-validators').innerHTML = Object.keys(this.#validators).length
    // this.shadowRoot.querySelector('.validators-online').innerHTML = Object.values(this.#validators).filter(validator => validator.lastSeen - new Date().getTime() > 30_000).length
  }

  protected willUpdate(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
    if (_changedProperties.has('validators')) {
      const onlineValidators = []
      for (const [id, validator] of Object.entries(this.validators)) {
        validator.lastSeen - new Date().getTime() > 30_000 && onlineValidators.push(id)
      }
      this.onlineValidators = onlineValidators
    }
  }

  #click = async () => client.participate(await client.selectedAccount())

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
        }
      `
    ]
  }

  render() {
    return html`
      <hero-element>
        <flex-row>
          <span>total validators</span>

          <flex-one></flex-one>
          <strong>${this.validators ? Object.keys(this.validators).length : '0'}</strong>
        </flex-row>

        <flex-row>
          <span>online validators</span>
          <flex-one></flex-one>
          <strong>${this.onlineValidators ? this.onlineValidators.length : '0'}</strong>
        </flex-row>

        <button @click=${this.#click}>participate</button>
      </hero-element>
    `
  }
}

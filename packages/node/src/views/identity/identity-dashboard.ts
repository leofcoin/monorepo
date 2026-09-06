// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { parseUnits } from '@leofcoin/utils'
import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { map } from 'lit/directives/map.js'
import '@vandeurenglenn/flex-elements/wrap-evenly.js'

@customElement('identity-dashboard')
export class IdentityDashboard extends LitElement {
  @property({ type: Object })
  accessor accounts

  render() {
    return html`
      <style>
        * {
          pointer-events: none;
        }

        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 24px;
          box-sizing: border-box;
        }
        flex-row {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          background: var(--secondary-background);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 12px 24px;
          max-width: 240px;
          max-height: 54px;
          width: 100%;
          height: 100%;
          justify-content: center;
          margin-bottom: 12px;
        }

        hero-element {
          height: auto;
          max-height: none;
          max-width: 720px;
        }
      </style>
      <hero-element>
        <flex-wrap-evenly>
          <flex-row>
            <strong>transactions</strong>
            <flex-it></flex-it>
            <span>${this.accounts?.totalTransactions || 0}</span>
          </flex-row>

          <flex-row>
            <strong>total amount</strong>
            <flex-it></flex-it>
            <span>${this.accounts?.totalValue || 0}</span>
          </flex-row>
        </flex-wrap-evenly>
      </hero-element>
    `
  }
}

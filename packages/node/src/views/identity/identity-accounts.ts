// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { parseUnits } from '@leofcoin/utils'
import { LitElement, html } from 'lit'
import { map } from 'lit/directives/map.js'
export default customElements.define(
  'identity-accounts',
  class IdentityAccounts extends LitElement {
    static properties = {
      accounts: {
        type: 'object'
      }
    }

    constructor() {
      super()
    }

    render() {
      return html`
        <style>
          * {
            pointer-events: none;
          }

          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            padding: 24px;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
          }
          .account-container {
            padding: 12px;
            box-sizing: border-box;
          }

          hero-element {
            height: auto;
            max-height: none;
            max-width: 720px;
          }
          flex-row {
            background: #2c314a00;
            border-radius: 24px;
            box-sizing: border-box;
            padding: 6px 12px;
            box-shadow: 0px 0px 16px 6px #8890b75c;
            max-height: 36px;
            width: 100%;
            height: 100%;
          }

          custom-selector {
            pointer-events: auto;
            height: 100%;
            width: 100%;
            max-width: 320px;
          }
        </style>
        <hero-element>
          <custom-selector>
            ${map(
              this.accounts,
              ([name, external, internal]) => html`
                <flex-row>
                  <strong>${name}</strong>
                  <flex-one></flex-one>
                  <custom-svg-icon icon="chevron-right"></custom-svg-icon>
                </flex-row>
              `
            )}
          </custom-selector>
        </hero-element>
      `
    }
  }
)

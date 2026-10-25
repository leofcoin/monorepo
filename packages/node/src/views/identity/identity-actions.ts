// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { parseUnits } from '@leofcoin/utils'
import { LitElement, html } from 'lit'
import * as qrcode from 'qrcode'

export default customElements.define(
  'identity-actions',
  class IdentityActions extends LitElement {
    static properties = {
      accounts: {
        type: 'object'
      }
    }

    constructor() {
      super()
    }

    async #export() {
      const shell = document.querySelector<
        HTMLElement & {
          requestWalletPassword(): Promise<string>
          showExport(qrcode: string, exported: string): void
        }
      >('app-shell')
      if (!shell) throw new Error('application shell is unavailable')
      const password = await shell.requestWalletPassword()
      const exported = await globalThis.identityController.export(password)
      const qr = await qrcode.toDataURL(exported)
      shell.showExport(qr, exported)
      console.log(qr)
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
        </style>
        <hero-element>
          <flex-row>
            <flex-one></flex-one>
            <button-element>view mnemonic</button-element>
            <flex-two></flex-two>
            <button-element @click=${this.#export}>export</button-element>
            <flex-one></flex-one>
          </flex-row>
        </hero-element>
      `
    }
  }
)

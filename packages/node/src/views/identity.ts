// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { parseUnits } from '@leofcoin/utils'
import { LiteElement, html, customElement, property } from '@vandeurenglenn/lite'
import '../elements/button.js'
import '../elements/navigation-bar.js'
import './../elements/hero.js'
import type { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'
import '@vandeurenglenn/lite-elements/icon.js'
import Router from '../router.js'

@customElement('identity-view')
export class IdentityView extends LiteElement {
  @property({ type: Object, consumer: true })
  accessor wallet

  @property({ type: Array })
  accessor accounts

  get pages(): CustomPages {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get navigation(): CustomPages {
    return this.shadowRoot.querySelector('navigation-bar')
  }

  async select(selected) {
    if (!customElements.get(`identity-${selected}`)) await import(`./identity-${selected}.js`)

    this.pages.select(selected)
    this.navigation.select(selected)
  }

  async onChange(propertyKey) {
    if (propertyKey === 'wallet') {
      this.accounts = this.wallet.accounts
    }
  }

  _customSelect({ detail }) {
    location.hash = `#!/identity/${detail}`
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
          width: 100%;
          height: 100%;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          color: var(--font-color);
        }

        .accounts-container {
          padding: 12px;
          box-sizing: border-box;
        }

        .account-container {
          padding: 12px;
          box-sizing: border-box;
        }

        .container {
          max-width: 480px;
          max-height: 480px;
          width: 100%;
          height: 100%;
          padding: 12px;
          box-sizing: border-box;
          background: #ffffff52;
          border-radius: 24px;
          box-shadow: 1px 1px 14px 0px #0000002e;
        }

        h2,
        h4 {
          margin: 0;
        }

        h2 {
          padding-bottom: 12px;
        }

        navigation-bar {
          padding-bottom: 24px;
          pointer-events: auto;
        }

        custom-pages {
          width: 100%;
          height: 100%;
          display: flex;
        }
        custom-tab {
          pointer-events: auto;
        }
        .main {
          width: 100%;
          align-items: center;
        }
      </style>

      <flex-column class="main">
        <custom-pages attr-for-selected="data-route" selected="dashboard">
          <identity-dashboard data-route="dashboard" .accounts=${this.accounts}></identity-dashboard>
          <identity-accounts data-route="accounts" .accounts=${this.accounts}></identity-accounts>
          <identity-account data-route="account" .accounts=${this.accounts}></identity-account>
          <identity-actions data-route="actions" .accounts=${this.accounts}></identity-actions>
        </custom-pages>
        <custom-tabs
          round
          class="wallet-nav"
          attr-for-selected="data-route"
          default-selected="dashboard"
          @selected=${(event: CustomEvent) => (location.hash = Router.bang(`identity/${event.detail}`))}
        >
          <custom-tab title="dashboard" data-route="dashboard">
            <custom-icon icon="dashboard"></custom-icon>
          </custom-tab>
          <custom-tab title="accounts" data-route="accounts">
            <custom-icon icon="accounts"></custom-icon>
          </custom-tab>
          <custom-tab title="actions" data-route="actions">
            <custom-icon icon="actions"></custom-icon>
          </custom-tab>
        </custom-tabs>
      </flex-column>
    `
  }
}

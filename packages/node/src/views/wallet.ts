import '../elements/account.js'
// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { LiteElement, customElement, property, html } from '@vandeurenglenn/lite'
import { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'
import '@vandeurenglenn/lite-elements/tabs.js'
import '@vandeurenglenn/lite-elements/tab.js'
import { WalletPay } from './wallet/wallet-pay.js'
import Router from '../router.js'

@customElement('wallet-view')
export class WalletView extends LiteElement {
  @property({ type: Array })
  accessor accounts

  @property({ type: String })
  accessor selectedAccount

  @property({ type: Object, consumer: true })
  accessor wallet

  get pages(): CustomPages {
    return this.shadowRoot.querySelector('custom-pages') as unknown as CustomPages
  }

  onChange(propertyKey, value) {
    if (propertyKey === 'wallet') {
      this.selectedAccount = this.wallet.accounts[this.wallet.selectedAccountIndex][1]
      this.accounts = this.wallet.accounts
      console.log(this.accounts)
    }
  }

  async select(selected) {
    let pages = this.pages
    for (let attempt = 0; !pages && attempt < 10; attempt += 1) {
      await new Promise(requestAnimationFrame)
      pages = this.pages
    }
    if (!pages) throw new Error('wallet navigation did not render')
    if (selected === 'pay') {
      const appShell = document.querySelector('app-shell')
      const appPages = appShell?.shadowRoot?.querySelector('custom-pages') as CustomPages | null
      if (appPages) appPages.style.position = 'fixed'

      const payEl = pages.querySelector('[data-route="pay"]') as WalletPay
      if (payEl) payEl.style.position = 'fixed'
    }

    if (!customElements.get(`wallet-${selected}`)) await import(`./wallet-${selected}.js`)
    pages.select(selected)
  }

  connectedCallback(): void {
    super.connectedCallback()
    if (Router.debang(location.hash).split('/').length === 1) location.hash = Router.bang(`wallet/send`)
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
        }
        custom-pages {
          width: 100%;
          height: 100%;
        }
        .main {
          width: 100%;
          align-items: center;
        }
        custom-tab {
          pointer-events: auto;
        }

        .tab-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .tab-label {
          font-size: 10px;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
      </style>
      <flex-column class="main">
        <custom-pages attr-for-selected="data-route">
          <wallet-send data-route="send" .wallet=${this.wallet}></wallet-send>
          <wallet-receive data-route="receive" .wallet=${this.wallet}></wallet-receive>
          <wallet-pay data-route="pay" .wallet=${this.wallet}></wallet-pay>
          <wallet-transactions data-route="transactions" .wallet=${this.wallet}></wallet-transactions>
        </custom-pages>
        <custom-tabs
          round
          class="wallet-nav"
          attr-for-selected="data-route"
          @selected=${(event: CustomEvent) => (location.hash = Router.bang(`wallet/${event.detail}`))}>
          <custom-tab title="pay" data-route="send">
            <div class="tab-content">
              <custom-icon icon="call_made"></custom-icon>
              <span class="tab-label">Pay</span>
            </div>
          </custom-tab>
          <custom-tab title="receive" data-route="receive">
            <div class="tab-content">
              <custom-icon icon="call_received"></custom-icon>
              <span class="tab-label">Receive</span>
            </div>
          </custom-tab>
          <custom-tab title="activity" data-route="transactions">
            <div class="tab-content">
              <custom-icon icon="list"></custom-icon>
              <span class="tab-label">Activity</span>
            </div>
          </custom-tab>
        </custom-tabs>
      </flex-column>
    `
  }
}

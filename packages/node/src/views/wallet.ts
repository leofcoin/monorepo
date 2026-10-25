import '../elements/account.js'
// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { LiteElement, customElement, property, html } from '@vandeurenglenn/lite'
import { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'
import Router from '../router.js'

@customElement('wallet-view')
export class WalletView extends LiteElement {
  #viewHistory = new Map<string, HTMLElement & { wallet?: unknown }>()

  @property({ type: Array })
  accessor accounts

  @property({ type: String })
  accessor selectedAccount

  @property({ type: String }) accessor selectedRoute = 'send'

  @property({ type: Object, consumer: true })
  accessor wallet

  viewWithOrWithoutHistory(view: string): HTMLElement {
    const routes = ['send', 'receive', 'pay', 'transactions']
    if (!routes.includes(view)) throw new Error(`Unknown wallet view: ${view}`)
    let page = this.#viewHistory.get(view)
    if (!page) {
      page = document.createElement(`wallet-${view}`)
      page.dataset.route = view
      this.#viewHistory.set(view, page)
    }
    return page
  }

  get pages(): CustomPages {
    const pages = this.shadowRoot?.querySelector<CustomPages>('custom-pages')
    if (!pages) throw new Error('wallet navigation did not render')
    return pages
  }

  onChange(propertyKey: string) {
    if (propertyKey === 'wallet' && this.wallet) {
      this.selectedAccount = this.wallet.accounts[this.wallet.selectedAccountIndex][1]
      this.accounts = this.wallet.accounts
      const page = this.#viewHistory.get(this.selectedRoute)
      if (page && customElements.get(page.localName)) page.wallet = this.wallet
      console.log(this.accounts)
    }
  }

  async select(selected: string) {
    if (!customElements.get(`wallet-${selected}`)) await import(`./wallet-${selected}.js`)
    this.selectedRoute = selected
    await this.rendered
    const page = this.#viewHistory.get(selected)
    if (page) page.wallet = this.wallet
    this.pages.select(selected)
  }

  connectedCallback(): void {
    super.connectedCallback()
    if (Router.debang(location.hash).split('/').length === 1) location.hash = Router.bang(`wallet/send`)
  }

  render() {
    return html`
      <style>
        :host {
          display: flex;
          flex-direction: row;
          width: 100%;
          height: 100%;
          justify-content: center;
          min-width: 0;
          min-height: 0;
          color: var(--md-sys-color-on-surface, #eee);
        }
        custom-pages {
          width: 100%;
          flex: 1;
          min-height: 0;
          min-width: 0;
        }
        .main {
          width: 100%;
          height: 100%;
          min-height: 0;
          align-items: center;
        }
        .wallet-nav {
          display: flex;
          flex: 0 0 auto;
          gap: 4px;
          padding: 6px;
          margin: 12px 16px max(16px, env(safe-area-inset-bottom));
          border: 1px solid var(--lfc-glass-border, #51474e);
          border-radius: 20px;
          background: var(--lfc-glass-surface, #242126);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        a {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 96px;
          padding: 0 12px;
          border-radius: 14px;
          text-decoration: none;
          box-sizing: border-box;
          color: var(--md-sys-color-on-surface-variant, #ccc);
          font-size: 13px;
          font-weight: 600;
          transition: background 150ms ease;
        }
        a:hover { background: var(--md-sys-color-surface-container-high); }
        a[aria-current='page'] {
          background: var(--md-sys-color-primary-container, #684536);
          color: var(--md-sys-color-on-primary-container, #ffdbca);
        }
        a:focus-visible { outline: 2px solid var(--md-sys-color-primary, #f4a77f); outline-offset: 2px; }
        @media (max-width: 420px) {
          .wallet-nav { align-self: stretch; margin: 8px 12px max(12px, env(safe-area-inset-bottom)); }
          a { flex: 1; min-width: 0; padding: 0 8px; }
        }
        @media (prefers-reduced-motion: reduce) { a { transition: none; } }
      </style>
      <flex-column class="main">
        <custom-pages attr-for-selected="data-route">
          ${this.viewWithOrWithoutHistory(this.selectedRoute)}
        </custom-pages>
        <nav class="wallet-nav" aria-label="Wallet">
          ${[
            { route: 'send', label: 'Pay', icon: 'call_made' },
            { route: 'receive', label: 'Receive', icon: 'call_received' },
            { route: 'transactions', label: 'Activity', icon: 'list' }
          ].map(({ route, label, icon }) => html`
            <a href=${Router.bang(`wallet/${route}`)} aria-current=${this.selectedRoute === route ? 'page' : 'false'}>
              <custom-icon icon=${icon} aria-hidden="true"></custom-icon><span>${label}</span>
            </a>
          `)}
        </nav>
      </flex-column>
    `
  }
}

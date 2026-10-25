// import { nativeToken } from './../../../node_modules/@leofcoin/addresses/src/addresses'
import { parseUnits } from '@leofcoin/utils'
import { LiteElement, html, customElement, property } from '@vandeurenglenn/lite'
import '../elements/button.js'
import '../elements/navigation-bar.js'
import './../elements/hero.js'
import type { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'
import { CustomTabs } from '@vandeurenglenn/lite-elements/tabs.js'
import '@vandeurenglenn/lite-elements/icon.js'
import Router from '../router.js'

@customElement('identity-view')
export class IdentityView extends LiteElement {
  #viewHistory = new Map<string, HTMLElement & { accounts?: unknown }>()

  @property({ type: Object, consumer: true })
  accessor wallet

  @property({ type: Array })
  accessor accounts

  @property({ type: String })
  accessor selectedRoute = 'dashboard'

  viewWithOrWithoutHistory(view: string): HTMLElement {
    const routes = ['dashboard', 'accounts', 'account', 'actions']
    if (!routes.includes(view)) throw new Error(`Unknown identity view: ${view}`)
    let page = this.#viewHistory.get(view)
    if (!page) {
      page = document.createElement(`identity-${view}`)
      page.dataset.route = view
      this.#viewHistory.set(view, page)
    }
    return page
  }

  get pages(): CustomPages | null {
    return this.shadowRoot?.querySelector<CustomPages>('custom-pages') ?? null
  }

  get navigation(): CustomTabs | null {
    return this.shadowRoot?.querySelector<CustomTabs>('custom-tabs') ?? null
  }

  async select(selected: string) {
    if (!customElements.get(`identity-${selected}`)) await import(`./identity-${selected}.js`)

    this.selectedRoute = selected
    await this.rendered
    const page = this.#viewHistory.get(selected)
    if (page && customElements.get(page.localName)) page.accounts = this.accounts
    let pages = this.pages
    let navigation = this.navigation
    for (let attempt = 0; (!pages || !navigation) && attempt < 10; attempt += 1) {
      await new Promise(requestAnimationFrame)
      pages = this.pages
      navigation = this.navigation
    }
    if (!pages || !navigation) throw new Error('identity navigation did not render')

    pages.select(selected)
    navigation.select(selected)
  }

  async onChange(propertyKey: string) {
    if (propertyKey === 'wallet' && this.wallet) {
      this.accounts = this.wallet.accounts
      const page = this.#viewHistory.get(this.selectedRoute)
      if (page && customElements.get(page.localName)) page.accounts = this.accounts
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
        <custom-pages attr-for-selected="data-route">
          ${this.viewWithOrWithoutHistory(this.selectedRoute)}
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

import { LiteElement, html, customElement, property } from '@vandeurenglenn/lite'
import type { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'
import type { IdentityAccount } from './view-polish.js'

@customElement('identity-view')
export class IdentityView extends LiteElement {
  #viewHistory = new Map<string, HTMLElement & { accounts?: IdentityAccount[] }>()

  @property({ type: Object, consumer: true })
  accessor wallet: { accounts: IdentityAccount[] } | undefined

  @property({ type: Array }) accessor accounts: IdentityAccount[] = []
  @property({ type: String }) accessor selectedRoute = 'dashboard'

  viewWithOrWithoutHistory(view: string): HTMLElement {
    if (!['dashboard', 'accounts', 'account', 'actions'].includes(view))
      throw new Error(`Unknown identity view: ${view}`)
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

  async select(selected: string) {
    if (!customElements.get(`identity-${selected}`)) await import(`./identity-${selected}.js`)
    this.selectedRoute = selected
    await this.rendered
    const page = this.#viewHistory.get(selected)
    if (page) page.accounts = this.accounts
    let pages = this.pages
    for (let attempt = 0; !pages && attempt < 10; attempt += 1) {
      await new Promise(requestAnimationFrame)
      pages = this.pages
    }
    if (!pages) throw new Error('Identity navigation did not render.')
    pages.select(selected)
  }

  onChange(propertyKey: string) {
    if (propertyKey === 'wallet') this.accounts = this.wallet?.accounts ?? []
    if (propertyKey === 'wallet' || propertyKey === 'accounts') {
      const page = this.#viewHistory.get(this.selectedRoute)
      if (page && customElements.get(page.localName)) page.accounts = this.accounts
    }
  }

  render() {
    return html`
      <style>
        :host { display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; color: var(--md-sys-color-on-surface, #eee); }
        custom-pages { width: 100%; flex: 1; min-width: 0; min-height: 0; display: flex; }
        nav { display: flex; align-self: center; gap: 4px; flex-shrink: 0; max-width: 100%; padding: 6px;
          margin: 12px 16px max(16px, env(safe-area-inset-bottom)); border: 1px solid var(--lfc-glass-border, #51474e);
          border-radius: 20px; background: var(--lfc-glass-surface, #242126); }
        a { display: flex; gap: 8px; align-items: center; justify-content: center; min-height: 44px;
          padding: 0 14px; border-radius: 14px; text-decoration: none; box-sizing: border-box;
          color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 13px; font-weight: 600;
          transition: background 160ms ease, transform 160ms ease; }
        svg { width: 19px; height: 19px; flex-shrink: 0; }
        a:hover { background: var(--md-sys-color-surface-container-high); transform: translateY(-1px); }
        a[aria-current='page'] { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
        a:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
        @media (max-width: 440px) {
          nav { align-self: stretch; margin: 8px 12px max(12px, env(safe-area-inset-bottom)); }
          a { flex: 1; padding: 0 8px; gap: 5px; font-size: 12px; }
        }
        @media (prefers-reduced-motion: reduce) { a { transition: none; } a:hover { transform: none; } }
      </style>
      <custom-pages attr-for-selected="data-route">${this.viewWithOrWithoutHistory(this.selectedRoute)}</custom-pages>
      <nav aria-label="Identity navigation">
        <a href="#!/identity/dashboard" aria-current=${this.selectedRoute === 'dashboard' ? 'page' : 'false'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>Overview
        </a>
        <a href="#!/identity/accounts" aria-current=${['accounts', 'account'].includes(this.selectedRoute) ? 'page' : 'false'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M5 17c0-5 8-5 8 0m2-8h3m-3 4h3"/></svg>Accounts
        </a>
        <a href="#!/identity/actions" aria-current=${this.selectedRoute === 'actions' ? 'page' : 'false'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>Backup
        </a>
      </nav>`
  }
}

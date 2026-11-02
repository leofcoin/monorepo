import { css, html, LiteElement, property, customElement } from '@vandeurenglenn/lite'
import type { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'
import { getSelectedNetwork } from '../network-selection.js'
import { explorerLink } from '../controllers/explorer-data.js'
import { resolveExplorerSearch } from '../controllers/explorer-search.js'
import { getExplorerSource } from '../controllers/public-explorer.js'

const tabs = [
  { route: 'dashboard', label: 'Overview' }, { route: 'blocks', label: 'Blocks' },
  { route: 'transactions', label: 'Transactions' }, { route: 'pool', label: 'Pending pool' }
]

@customElement('explorer-view')
export class ExplorerView extends LiteElement {
  #viewHistory = new Map<string, HTMLElement>()
  @property() accessor selected = 'dashboard'
  @property({ type: Boolean, consumes: true }) accessor isNodeReady = false
  @property({ type: Boolean, consumes: true }) accessor nodeStarted = false
  @property({ type: String, consumes: true }) accessor nodeStartError = ''
  @property({ type: Number, consumes: true }) accessor lastBlockIndex: number | null = null
  @property({ type: Number, consumes: true }) accessor syncTargetIndex: number | null = null
  @property() accessor searchQuery = ''
  @property() accessor searchError = ''
  @property({ type: Boolean }) accessor searching = false
  @property() accessor sourceKind = ''
  @property() accessor sourceLabel = 'Connecting…'
  @property() accessor sourceError = ''
  #sourceRequest = 0

  #connectSource = async () => {
    const request = ++this.#sourceRequest
    this.sourceError = ''
    try {
      const source = await getExplorerSource()
      if (request !== this.#sourceRequest || !this.isConnected) return
      this.sourceKind = source.kind
      this.sourceLabel = source.label
      globalThis.pubsub?.publish('explorer:source-ready', { kind: source.kind })
    } catch (error) {
      if (request === this.#sourceRequest && this.isConnected) this.sourceError = error instanceof Error ? error.message : String(error)
    }
  }

  connectedCallback() {
    super.connectedCallback()
    globalThis.pubsub?.subscribe('node:ready', this.#connectSource)
    void this.#connectSource()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.#sourceRequest++
    globalThis.pubsub?.unsubscribe('node:ready', this.#connectSource, { keepValue: true })
  }

  get pages(): CustomPages {
    const pages = this.shadowRoot?.querySelector<CustomPages>('custom-pages')
    if (!pages) throw new Error('explorer navigation did not render')
    return pages
  }

  viewWithOrWithoutHistory(view: string): HTMLElement {
    const routes = ['dashboard', 'blocks', 'block', 'block-transactions', 'transactions', 'transaction', 'pool']
    if (!routes.includes(view)) throw new Error(`Unknown explorer view: ${view}`)
    let page = this.#viewHistory.get(view)
    if (!page) {
      page = document.createElement(`explorer-${view}`)
      page.dataset.route = view
      this.#viewHistory.set(view, page)
    }
    return page
  }

  async select(selected: string) {
    const routes = [...tabs.map(tab => tab.route), 'block', 'transaction', 'block-transactions']
    if (!routes.includes(selected)) throw new Error(`Unknown explorer view: ${selected}`)
    if (!customElements.get(`explorer-${selected}`)) await import(`./explorer-${selected}.js`)
    const cached = this.#viewHistory.get(selected) as any
    if (cached && ['transaction', 'block', 'block-transactions'].includes(selected)) {
      cached.selected = ''
      if (selected === 'transaction') { cached.blockIndex = ''; cached.blockHash = '' }
    }
    this.selected = selected
    this.searchError = ''
    await this.rendered
    this.pages.select(selected)
  }

  async #search(event: Event) {
    event.preventDefault()
    if (this.searching) return
    this.searchError = ''
    this.searching = true
    try {
      location.hash = await resolveExplorerSearch(this.searchQuery, getExplorerSource)
    } catch (error) { this.searchError = error instanceof Error ? error.message : String(error) }
    finally { this.searching = false }
  }

  static styles = css`
    :host { display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; overflow: hidden; color: var(--md-sys-color-on-surface, #eee); }
    * { box-sizing: border-box; }
    .explorer-top { padding: 20px 24px 0; flex-shrink: 0; border-bottom: 1px solid var(--lfc-glass-border, #51474e); background: var(--md-sys-color-surface, #1b191e); }
    .top-row { max-width: 1192px; margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: 12px; }
    .title svg { width: 34px; height: 34px; color: var(--md-sys-color-primary, #9fc4ff); }
    h1 { font-size: 18px; margin: 0; letter-spacing: -.025em; }
    .subtle { display: block; font-size: 11px; margin-top: 3px; color: var(--md-sys-color-on-surface-variant, #bbc); }
    form { display: flex; gap: 8px; flex: 0 1 560px; min-width: 0; }
    input, button { min-height: 44px; font: inherit; font-size: 12px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 10px; padding: 8px 12px; background: var(--md-sys-color-surface-container-low, #1d1b20); color: inherit; min-width: 0; }
    input { flex: 1; }
    button { cursor: pointer; }
    button:disabled { opacity: .45; cursor: default; }
    button:hover:not(:disabled) { background: var(--md-sys-color-surface-container-high, #34313a); }
    :focus-visible { outline: 2px solid var(--md-sys-color-primary, #9fc4ff); outline-offset: 2px; }
    nav { max-width: 1192px; margin: 16px auto 0; display: flex; gap: 24px; overflow-x: auto; }
    nav a { display: block; padding: 12px 2px; border-bottom: 2px solid transparent; color: var(--md-sys-color-on-surface-variant, #bbc); text-decoration: none; font-size: 13px; white-space: nowrap; }
    nav a[aria-current='page'] { border-color: var(--md-sys-color-primary, #9fc4ff); color: var(--md-sys-color-primary, #9fc4ff); font-weight: 650; }
    .banner { padding: 10px 24px; font-size: 12px; background: var(--md-sys-color-surface-container-low, #1d1b20); color: var(--md-sys-color-on-surface-variant, #bbc); border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
    .error { font-size: 12px; color: var(--md-sys-color-error, #ffb4ab); margin: 10px auto; max-width: 1192px; }
    custom-pages { width: 100%; flex: 1; min-height: 0; min-width: 0; }
    @media (max-width: 700px) {
      .explorer-top { padding: 16px 12px 0; }
      .top-row { gap: 14px; }
      form { flex: 1 0 100%; width: 100%; gap: 6px; }
      input, button { padding: 8px; }
      nav { gap: 20px; margin-top: 8px; }
      .banner { padding: 10px 12px; }
    }
  `

  render() {
    const active = this.selected === 'block' || this.selected === 'block-transactions' ? 'blocks' : this.selected === 'transaction' ? 'transactions' : this.selected
    return html`<div class="explorer-top"><div class="top-row">
      <div class="title"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 3 12 7v13l-12 7-12-7V10ZM4 10l12 7 12-7M16 17v13" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><div><h1>Block explorer</h1><span class="subtle">${getSelectedNetwork().label} · ${this.sourceLabel}</span></div></div>
      <form @submit=${(event: Event) => this.#search(event)}>
        <input aria-label="Explorer search" type="search" placeholder="Block index, block hash or transaction hash" maxlength="160" spellcheck="false" autocapitalize="off" .value=${this.searchQuery} @input=${(event: Event) => { this.searchQuery = (event.target as HTMLInputElement).value; this.searchError = '' }} />
        <button ?disabled=${this.searching || !this.searchQuery.trim()}>${this.searching ? '…' : 'Search'}</button>
      </form></div>
      ${this.searchError ? html`<p class="error" role="alert">${this.searchError}</p>` : ''}
      <nav aria-label="Explorer sections">${tabs.map(tab => html`<a href=${explorerLink(tab.route)} aria-current=${active === tab.route ? 'page' : 'false'}>${tab.label}</a>`)}</nav>
    </div>
    ${this.sourceError ? html`<div class="banner" role="alert">${this.sourceError} <button @click=${this.#connectSource}>Retry public connection</button></div>`
      : this.sourceKind === 'public' ? html`<div class="banner" role="status">Public read-only explorer. No wallet is opened. Data is reported by ${this.sourceLabel}, not independently validated by this browser.</div>`
      : !this.isNodeReady ? html`<div class="banner" role="status">${this.nodeStartError ? `Local node unavailable: ${this.nodeStartError}` : 'Connecting to explorer data. A wallet login is not required.'}</div>` : ''}
    <custom-pages attr-for-selected="data-route">${this.viewWithOrWithoutHistory(this.selected)}</custom-pages>`
  }
}

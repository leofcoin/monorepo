import { css, html, LiteElement, property, query, customElement } from '@vandeurenglenn/lite'
import '../elements/latest.js'
import '../elements/explorer/info-container.js'
import '../elements/navigation-bar.js'
import Router from './../router.js'

@customElement('explorer-view')
export class ExplorerView extends LiteElement {
  @property() accessor selected

  @property({ type: Boolean, consumes: true }) accessor isNodeReady = false

  @property({ type: Boolean, consumes: true }) accessor nodeStarted = false

  @property({ type: String, consumes: true }) accessor nodeStartError = ''

  @property({ type: Number, consumes: true }) accessor lastBlockIndex = 0

  @property({ type: Number, consumes: true }) accessor syncStartIndex = 0

  @property({ type: Number, consumes: true }) accessor syncTargetIndex = 0

  @property({ type: Number, consumes: true }) accessor totalResolved = 0

  @property({ type: Number, consumes: true }) accessor totalLoaded = 0

  get syncPercent() {
    const total = this.syncTargetIndex - this.syncStartIndex
    if (total <= 0) return this.isNodeReady ? 100 : 0
    return Math.max(0, Math.min(100, Math.round(((this.lastBlockIndex - this.syncStartIndex) / total) * 100)))
  }

  get syncStatus() {
    if (this.nodeStartError) return 'Explorer unavailable.'
    if (!this.nodeStarted) return 'Unlock your wallet to start Explorer.'
    if (!this.syncTargetIndex) return 'Connecting Explorer to the Peach network...'
    return `Explorer is syncing to block ${this.syncTargetIndex}.`
  }

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }
        custom-pages {
          width: 100%;
          height: 100%;
        }

        .sync-banner {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--md-sys-color-surface-container-high);
          color: var(--md-sys-color-on-surface);
          padding: 8px 12px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
        }
      `
    ]
  }

  @query('custom-pages')
  accessor pages

  async select(selected) {
    console.log(selected)
    this.selected = selected
    if (!customElements.get(`explorer-${selected}`)) await import(`./explorer-${selected}.js`)
    this.pages.select(selected)
    this.shadowRoot.querySelector('navigation-bar')?.select(selected)
  }

  #customSelect({ detail }) {
    location.hash = `#!/explorer/${detail}`
    // this.select(detail)
  }

  render() {
    return html`
      ${this.isNodeReady
        ? ''
        : html`<div class="sync-banner">
            <span>${this.syncStatus}</span>
            <strong>${this.syncTargetIndex ? `${this.syncPercent}%` : '—'}</strong>
          </div>`}

      <custom-pages attr-for-selected="data-route">
        <explorer-dashboard data-route="dashboard"></explorer-dashboard>
        <explorer-blocks data-route="blocks"></explorer-blocks>
        <explorer-block data-route="block"></explorer-block>
        <explorer-block-transactions data-route="block-transactions"></explorer-block-transactions>
        <explorer-transactions data-route="transactions"></explorer-transactions>
        <explorer-transaction data-route="transaction"></explorer-transaction>
        <explorer-pool data-route="pool"></explorer-pool>
      </custom-pages>

      ${this.selected === 'transactions' ||
      this.selected === 'blocks' ||
      this.selected === 'dashboard' ||
      this.selected === 'pool'
        ? html`
            <custom-tabs
              round
              class="wallet-nav"
              attr-for-selected="data-route"
              default-selected="dashboard"
              @selected=${(event: CustomEvent) => (location.hash = Router.bang(`explorer/${event.detail}`))}>
              <custom-tab title="dashboard" data-route="dashboard">
                <custom-icon icon="dashboard"></custom-icon>
              </custom-tab>
              <custom-tab title="blocks" data-route="blocks">
                <custom-icon icon="stack"></custom-icon>
              </custom-tab>
              <custom-tab title="transactions" data-route="transactions">
                <custom-icon icon="list"></custom-icon>
              </custom-tab>

              <custom-tab title="pool" data-route="pool">
                <custom-icon icon="pool"></custom-icon>
              </custom-tab>
            </custom-tabs>
          `
        : ''}
    `
  }
}

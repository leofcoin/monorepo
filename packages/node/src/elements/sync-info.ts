import { LiteElement, css, html, property, query } from '@vandeurenglenn/lite'
import '@vandeurenglenn/lite-elements/pane.js'
import { CustomPane } from '@vandeurenglenn/lite-elements/pane.js'
export class SyncInfo extends LiteElement {
  @property({ type: Boolean })
  accessor open: boolean

  @property({ type: Boolean, consumes: true })
  accessor isNodeReady = false

  @property({ type: Boolean, consumes: true })
  accessor nodeStarted = false

  @property({ type: String, consumes: true })
  accessor nodeStartError = ''

  @property({ type: Number, consumes: true })
  accessor syncStartIndex = 0

  @property({ type: Number, consumes: true })
  accessor syncTargetIndex = 0

  @property({ type: Number, consumes: true })
  accessor lastBlockIndex = 0

  @property({ type: Number, consumes: true })
  accessor totalResolved = 0

  @property({ type: Number, consumes: true })
  accessor totalLoaded = 0

  @query('custom-pane')
  accessor pane: CustomPane

  @property({ type: String }) accessor id = crypto.randomUUID()

  get progress() {
    const total = this.syncTargetIndex - this.syncStartIndex
    if (total <= 0) return this.isNodeReady ? 100 : 0
    const completed = this.lastBlockIndex - this.syncStartIndex
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
  }

  get hasProgress() {
    return this.nodeStarted && this.syncTargetIndex > 0
  }

  get status() {
    if (this.nodeStartError) return `Node could not start: ${this.nodeStartError}`
    if (!this.nodeStarted) return 'Unlock your wallet to start the browser node.'
    if (this.isNodeReady) return 'Node synced and ready.'
    if (!this.syncTargetIndex) return 'Connecting to the Peach network...'
    return `Syncing chain data (${this.progress}%).`
  }

  static styles = [
    css`
      :host {
        display: contents;
      }
      custom-pane {
        bottom: 0;
        left: 50%;
        max-width: 1200px;
        color: #eee;
        border-radius: var(--md-sys-shape-corner-large-top);
        transform: translateX(-50%) translateY(100%);
      }
      custom-pane[open] {
        transform: translateX(-50%) translateY(0);
      }

      main {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .status {
        font-weight: 600;
      }

      .progress-track {
        height: 8px;
        border-radius: 999px;
        background: var(--md-sys-color-surface-container-highest);
        overflow: hidden;
      }

      .progress-value {
        height: 100%;
        background: var(--md-sys-color-primary);
        transition: width 220ms ease;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .metric {
        padding: 8px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        background: var(--md-sys-color-surface-container-high);
      }

      .metric strong {
        display: block;
      }
    `
  ]

  firstRender(): void {
    document.addEventListener('custom-pane-close', ({ detail }) => {
      console.log({ detail })

      if (detail === this.id) {
        this.open = false
      }
    })
  }

  render() {
    return html`
      <custom-pane
        .id=${this.id}
        .open=${this.open}
        left
        icon="close"
        title="Sync Info"
        @custom-pane-close=${() => (this.open = false)}>
        <main slot="content">
          <p class="status">${this.status}</p>
          <div
            class="progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow=${this.nodeStarted ? this.progress : undefined}>
            <div class="progress-value" style=${`width: ${this.progress}%`}></div>
          </div>
          <div class="metrics">
            <div class="metric">
              <small>Progress</small>
              <strong>${this.hasProgress ? `${this.progress}%` : '—'}</strong>
            </div>
            <div class="metric">
              <small>Current block</small>
              <strong>${this.lastBlockIndex}</strong>
            </div>
            <div class="metric">
              <small>Resolved</small>
              <strong>${this.totalResolved}</strong>
            </div>
            <div class="metric">
              <small>Loaded</small>
              <strong>${this.totalLoaded}</strong>
            </div>
            <div class="metric">
              <small>Target block</small>
              <strong>${this.syncTargetIndex || '—'}</strong>
            </div>
          </div>
        </main>
      </custom-pane>
    `
  }
}
customElements.define('sync-info', SyncInfo)

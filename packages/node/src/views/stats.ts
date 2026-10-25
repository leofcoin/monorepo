import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { nodeActivity } from '../controllers/node-activity.js'
import { getSelectedNetwork } from '../network-selection.js'

export interface NodeStatus {
  label: string
  ready: boolean
  started: boolean
  error: string
  progress: number
  local: number
  target: number
  resolved: number
  loaded: number
  peers: string[]
}

const sizeLabel = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`

@customElement('stats-view')
export class StatsView extends LitElement {
  @property({ type: Object }) accessor nodeStatus: NodeStatus = {
    label: 'Wallet locked', ready: false, started: false, error: '',
    progress: 0, local: 0, target: 0, resolved: 0, loaded: 0, peers: []
  }
  @state() accessor snapshot = nodeActivity.snapshot()
  @state() accessor direction = 'all'
  @state() accessor transport = 'all'
  @state() accessor onlyErrors = false
  @state() accessor paused = false
  #timer: ReturnType<typeof setInterval> | undefined

  connectedCallback() {
    super.connectedCallback()
    this.snapshot = nodeActivity.snapshot()
    this.#timer = setInterval(() => {
      if (!this.paused) this.snapshot = nodeActivity.snapshot()
    }, 1000)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this.#timer)
  }

  static styles = css`
    :host { display: block; width: 100%; height: 100%; overflow: auto; box-sizing: border-box; padding: 24px; color: var(--md-sys-color-on-surface, #eee); }
    main { max-width: 1200px; margin: auto; display: grid; gap: 20px; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 30px; letter-spacing: -.035em; }
    h2 { font-size: 17px; }
    header, .card { display: grid; gap: 14px; min-width: 0; }
    .eyebrow { color: var(--md-sys-color-primary, #8dbbff); font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .muted, dt { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 12px; }
    .card { padding: 20px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 20px; background: var(--lfc-glass-surface, #242126); }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { display: grid; gap: 8px; }
    .metric strong { font-size: 28px; font-variant-numeric: tabular-nums; }
    .overview { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
    .section-heading, .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .status { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .status svg { width: 22px; height: 22px; color: var(--md-sys-color-primary, #8dbbff); }
    .status[data-ready] svg { color: var(--md-sys-color-secondary, #80d6a5); }
    progress { width: 100%; height: 10px; accent-color: var(--md-sys-color-primary, #8dbbff); }
    dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; gap: 12px; }
    dd { margin: 6px 0 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    ul { padding: 0; margin: 0; list-style: none; max-height: 150px; overflow: auto; }
    li { font: 12px ui-monospace, monospace; overflow-wrap: anywhere; padding: 6px 0; }
    button, select { min-height: 40px; font: inherit; font-size: 12px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 10px; background: var(--md-sys-color-surface-container, #171619); color: inherit; padding: 8px 12px; }
    button { cursor: pointer; }
    button:hover { background: var(--md-sys-color-surface-container-high, #302d32); }
    button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--md-sys-color-primary, #8dbbff); outline-offset: 2px; }
    label { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .filters { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
    .table-scroll { overflow: auto; max-height: 480px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
    th { color: var(--md-sys-color-on-surface-variant, #ccc); position: sticky; top: 0; background: var(--md-sys-color-surface-container, #242126); }
    th, td { padding: 10px; border-bottom: 1px solid var(--lfc-glass-border, #51474e); white-space: nowrap; }
    td.remote { max-width: 240px; overflow: hidden; text-overflow: ellipsis; font-family: ui-monospace, monospace; }
    .in { color: var(--md-sys-color-secondary, #80d6a5); }
    .out { color: var(--md-sys-color-primary, #8dbbff); }
    .error { color: var(--md-sys-color-error, #ffb4ab); }
    .empty { padding: 28px; text-align: center; }
    @media (max-width: 700px) {
      :host { padding: 14px; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .overview { grid-template-columns: 1fr; }
      dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .card { padding: 16px; }
    }
  `

  render() {
    const { totals } = this.snapshot
    const status = this.nodeStatus
    const events = this.snapshot.events.filter((event) =>
      (this.direction === 'all' || event.direction === this.direction) &&
      (this.transport === 'all' || event.transport === this.transport) &&
      (!this.onlyErrors || event.outcome === 'error')
    )
    return html`<main>
      <header><span class="eyebrow">${getSelectedNetwork().label} · Live diagnostics</span>
        <h1>Node activity</h1><p class="muted">Sync, connections and observed network traffic. Metadata only, stored in memory for this tab.</p>
      </header>
      <div class="metrics">
        <section class="card metric"><span class="muted">Incoming events</span><strong class="in">${totals.incoming}</strong><span class="muted">${sizeLabel(totals.bytesIn)} measured</span></section>
        <section class="card metric"><span class="muted">Outgoing events</span><strong class="out">${totals.outgoing}</strong><span class="muted">${sizeLabel(totals.bytesOut)} measured</span></section>
        <section class="card metric"><span class="muted">Connected peers</span><strong>${status.peers.length}</strong><span class="muted">Current browser node</span></section>
        <section class="card metric"><span class="muted">Failed operations</span><strong class=${totals.errors ? 'error' : ''}>${totals.errors}</strong><span class="muted">Since last clear</span></section>
      </div>
      <div class="overview">
        <section class="card">
          <div class="section-heading"><h2>Chain sync</h2><span class="status" ?data-ready=${status.ready}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${status.label}</span></div>
          ${status.started && (status.target > 0 || status.ready) ? html`<progress aria-label="Chain sync progress" max="100" value=${status.progress}></progress>` : ''}
          ${status.error ? html`<p class="error" role="alert">${status.error}</p>` : ''}
          <dl>
            <div><dt>Local block</dt><dd>${status.local}</dd></div>
            <div><dt>Target block</dt><dd>${status.target || 'Not known'}</dd></div>
            <div><dt>Blocks resolved</dt><dd>${status.resolved}</dd></div>
            <div><dt>Blocks loaded</dt><dd>${status.loaded}</dd></div>
          </dl>
        </section>
        <section class="card"><h2>Connected nodes</h2>
          ${status.peers.length ? html`<ul>${status.peers.map((id) => html`<li>${id}</li>`)}</ul>` : html`<p class="muted">No connected peers.</p>`}
          <span class="muted">Version @version · Build @build</span>
        </section>
      </div>
      <section class="card">
        <div class="toolbar"><h2>Network activity</h2><div class="filters">
          <button @click=${() => { this.paused = !this.paused; if (!this.paused) this.snapshot = nodeActivity.snapshot() }}
            aria-pressed=${String(this.paused)}>${this.paused ? 'Resume live view' : 'Pause live view'}</button>
          <button @click=${() => { nodeActivity.clear(); this.snapshot = nodeActivity.snapshot() }}>Clear activity</button>
        </div></div>
        <div class="filters">
          <label>Direction <select aria-label="Traffic direction" @change=${(event: Event) => (this.direction = (event.target as HTMLSelectElement).value)}>
            <option value="all">All</option><option value="in">Incoming</option><option value="out">Outgoing</option>
          </select></label>
          <label>Transport <select aria-label="Traffic transport" @change=${(event: Event) => (this.transport = (event.target as HTMLSelectElement).value)}>
            <option value="all">All</option><option>P2P</option><option>HTTP</option><option>WS</option>
          </select></label>
          <label><input type="checkbox" @change=${(event: Event) => (this.onlyErrors = (event.target as HTMLInputElement).checked)} /> Errors only</label>
          <span class="muted">${this.paused ? 'Display paused; capture continues' : 'Live'} · ${events.length} shown · last 300 retained</span>
        </div>
        <p class="muted">P2P protocol messages and peer requests; page fetch calls; WebSockets opened after monitoring starts.
          This is an application event log, not a packet capture. Worker-internal traffic, browser assets and existing sockets are not covered.
          Sizes exclude unknown HTTP bodies and protocol overhead. URLs show origins only; payloads, query strings and credentials are never retained.</p>
        <div class="table-scroll">
          <table><thead><tr><th>Time</th><th>Direction</th><th>Transport</th><th>Operation</th><th>Peer / endpoint</th><th>Size</th><th>Result</th><th>Duration</th></tr></thead>
            <tbody>${events.map((event) => html`<tr>
              <td>${new Date(event.timestamp).toLocaleTimeString()}</td><td class=${event.direction === 'in' ? 'in' : 'out'}>${event.direction === 'in' ? '↓ In' : '↑ Out'}</td>
              <td>${event.transport}</td><td>${event.operation}</td><td class="remote" title=${event.remote}>${event.remote || 'Unknown'}</td>
              <td>${event.bytes === null ? '—' : sizeLabel(event.bytes)}</td>
              <td class=${event.outcome === 'error' ? 'error' : ''}>${event.outcome}</td>
              <td>${event.duration === null ? '—' : `${Math.round(event.duration)} ms`}</td>
            </tr>`)}</tbody>
          </table>
          ${!events.length ? html`<p class="empty muted">No matching activity. Traffic will appear as this node communicates.</p>` : ''}
        </div>
      </section>
    </main>`
  }
}

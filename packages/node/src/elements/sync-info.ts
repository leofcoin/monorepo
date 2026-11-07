import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { getSelectedNetwork } from '../network-selection.js'
import { consoleDrawerStyles, isBackdropClick } from './console-drawer-styles.js'
import type { NodeStatus } from '../views/stats.js'

@customElement('sync-info')
export class SyncInfo extends LitElement {
  @property({ type: Boolean }) accessor open = false
  @property({ type: Object }) accessor nodeStatus: NodeStatus
  @property() accessor chainId = ''

  connectedCallback() {
    super.connectedCallback()
    this.requestUpdate() // Cached drawers must reconcile the native dialog again.
  }

  updated() {
    if (!this.isConnected) return
    const dialog = this.shadowRoot.querySelector('dialog')
    if (this.open && !dialog.open) dialog.showModal()
    else if (!this.open && dialog.open) dialog.close()
  }

  #close = () => {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new CustomEvent('sync-info-close', { bubbles: true, composed: true }))
  }

  static styles = [consoleDrawerStyles, css`
    main { overflow: auto; overscroll-behavior: contain; flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
    .summary { padding: 20px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 18px; }
    .status { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 650; }
    .dot { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; background: var(--md-sys-color-primary, #9fc4ff); }
    .ready .dot { background: #80d6a5; }
    .error .dot { background: var(--md-sys-color-error, #ffb4ab); }
    progress { display: block; width: 100%; height: 8px; margin-top: 18px; accent-color: var(--md-sys-color-primary, #9fc4ff); }
    .progress-label { display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: var(--md-sys-color-on-surface-variant, #ccc); }
    dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
    dl > div { padding: 16px; border-radius: 14px; background: var(--md-sys-color-surface-container-low, #1d1b20); }
    dt { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 12px; }
    dd { margin: 8px 0 0; font-size: 24px; font-variant-numeric: tabular-nums; }
    h3 { font-size: 13px; margin: 0 0 14px; }
    ol { padding: 0; margin: 0; list-style: none; display: grid; gap: 18px; }
    li { display: grid; grid-template-columns: 28px 1fr; gap: 12px; font-size: 13px; }
    .step { border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 50%; width: 26px; height: 26px; display: grid; place-items: center; }
    .complete .step { color: #80d6a5; border-color: #80d6a555; }
    li p { margin: 2px 0 0; font-size: 12px; }
    code { display: block; margin-top: 8px; font: 11px/1.7 ui-monospace, monospace; overflow-wrap: anywhere; color: var(--md-sys-color-on-surface-variant, #ccc); }
    footer .action { width: 100%; }
    footer p { font-size: 11px; text-align: center; margin-top: 12px; }
  `]

  render() {
    const status = this.nodeStatus
    const connected = (status?.peers.length || 0) > 0
    const compatible = (status?.compatible || 0) > 0
    const knownTarget = status?.target !== null && status?.target !== undefined && status.target >= 0
    const description = status?.error || (!status?.started ? 'Unlock your wallet to start the browser node.'
      : !connected ? 'The node is running, but has no connected peers. Waiting to discover the network.'
      : !compatible ? 'A connection alone is not enough. A compatible protocol version must be confirmed.'
      : status.ready ? knownTarget ? 'Local execution has caught up with the observed network target.' : 'The local chain reports synced and has compatible peer connections.'
      : status.state === 'error' ? 'Chain synchronization was interrupted. Inspect node activity for connection and request errors.'
      : 'Fetching and applying chain data from compatible peers.')
    return html`<dialog aria-labelledby="sync-title"
      @cancel=${(event: Event) => { event.preventDefault(); this.#close() }}
      @close=${(event: Event) => {
        // Native close events are queued. An old event must not close a drawer
        // that has already been reinserted and reopened in the meantime.
        if (!(event.target as HTMLDialogElement).open) this.#close()
      }}
      @click=${(event: MouseEvent) => { if (isBackdropClick(event)) this.#close() }}>
      <header><div><span class="eyebrow">${getSelectedNetwork().label} · Network</span><h2 id="sync-title">Node sync</h2><p>A live view of this browser node</p></div>
        <button class="close" aria-label="Close sync details" @click=${this.#close}>×</button></header>
      <main>
        <section class=${`summary ${status?.state || ''}`}>
          <div class="status" role="status"><span class="dot" aria-hidden="true"></span>${status?.label || 'Waiting for node status'}</div>
          <p>${description}</p>
          ${knownTarget && status?.progress !== null && status?.progress !== undefined && (status.ready || status.state === 'syncing')
            ? html`<progress aria-label="Chain catch-up progress" max="100" value=${status.progress}></progress>
              <div class="progress-label"><span>Observed catch-up</span><strong>${status.progress}%</strong></div>` : ''}
        </section>
        <dl>
          <div><dt>Local block</dt><dd>${status?.local ?? '—'}</dd></div>
          <div><dt>Observed target</dt><dd>${knownTarget ? status.target : '—'}</dd></div>
          <div><dt>Connected peers</dt><dd>${status?.peers.length ?? 0}</dd></div>
          <div><dt>Compatible peers</dt><dd>${status?.compatible ?? 0}</dd></div>
        </dl>
        <section><h3>Connection checklist</h3><ol>
          <li class=${status?.started ? 'complete' : ''}><span class="step">${status?.started ? '✓' : '1'}</span><div><strong>Start the node</strong><p>${status?.started ? 'Browser node startup requested.' : 'Your wallet remains locked.'}</p></div></li>
          <li class=${compatible ? 'complete' : ''}><span class="step">${compatible ? '✓' : '2'}</span><div><strong>Find compatible peers</strong><p>${status?.compatible ?? 0} compatible · ${status?.negotiating ?? 0} awaiting a version</p></div></li>
          <li class=${status?.ready ? 'complete' : ''}><span class="step">${status?.ready ? '✓' : '3'}</span><div><strong>Apply chain data</strong><p>${status?.resolved ?? 0} resolved · ${status?.loaded ?? 0} loaded this session</p></div></li>
        </ol></section>
        ${this.chainId ? html`<section><h3>Active chain identity</h3><code>${this.chainId}</code></section>` : ''}
      </main>
      <footer><a class="action" href="#!/stats" @click=${this.#close}>Open node activity →</a><p>Local sync does not confirm transaction finality.</p></footer>
    </dialog>`
  }
}

import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { getSelectedNetwork } from '../network-selection.js'
import { browserStorageOverview, scheduleStorageMaintenance, storageOperation } from '../controllers/browser-storage.js'
import { errorMessage } from '../controllers/transfer.js'
import { viewPolish } from './view-polish.js'

@customElement('settings-view')
export class SettingsView extends LitElement {
  @state() accessor overview: any
  @state() accessor loading = false
  @state() accessor error = ''
  @state() accessor action: 'chain' | 'pool' | '' = ''
  @state() accessor confirmation = ''
  @state() accessor scheduling = false
  #networkKey = ''

  connectedCallback() { super.connectedCallback(); void this.#refresh() }
  disconnectedCallback() { super.disconnectedCallback(); this.shadowRoot?.querySelector('dialog')?.close() }
  async #refresh() {
    if (this.loading) return
    this.loading = true; this.error = ''
    try { this.overview = await browserStorageOverview({ networkKey: getSelectedNetwork().key }) }
    catch (error) { this.error = errorMessage(error) }
    finally { this.loading = false }
  }
  #bytes(value?: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
    if (value < 1024) return `${value} B`
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
    return `${(value / 1024 ** 3).toFixed(1)} GB`
  }
  get #phrase() { return this.action === 'chain' ? 'DELETE BLOCKS' : 'CLEAR PENDING' }
  #open = async (action: 'chain' | 'pool') => {
    this.#networkKey = getSelectedNetwork().key
    this.action = action; this.confirmation = ''; this.error = ''
    await this.updateComplete
    if (!this.isConnected) return
    this.shadowRoot.querySelector('dialog').showModal()
    this.shadowRoot.querySelector<HTMLInputElement>('dialog input')?.focus()
  }
  #close = () => { if (!this.scheduling) this.shadowRoot.querySelector('dialog')?.close() }
  #confirm = (event: SubmitEvent) => {
    event.preventDefault()
    if (!this.action || this.confirmation !== this.#phrase || this.scheduling) return
    if (this.#networkKey !== getSelectedNetwork().key) { this.error = 'Network changed; close and review the operation again.'; return }
    this.scheduling = true
    try { scheduleStorageMaintenance({ action: this.action, networkKey: this.#networkKey }) }
    catch (error) { this.error = errorMessage(error); this.scheduling = false }
  }
  static styles = [viewPolish, css`
    .heading { display:flex; align-items:start; gap:20px; } .heading>div { flex:1; }
    .heading h1 { margin-top:0; } .heading button { flex-shrink:0; }
    .storage-numbers { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:18px 0; }
    .storage-numbers strong { display:block; font-size:26px; margin-top:8px; }
    .store-list { margin:0; padding:0; list-style:none; } .store-list li { display:flex; justify-content:space-between; gap:20px; padding:11px 0; border-top:1px solid var(--lfc-glass-border,#45414c); font-size:13px; }
    code { overflow-wrap:anywhere; } .operation { display:grid; grid-template-columns:1fr auto; align-items:start; gap:20px; padding:20px 0; }
    .operation+.operation { border-top:1px solid var(--lfc-glass-border,#45414c); } .operation h3 { margin-bottom:8px; }
    .danger { background:transparent; border-color:var(--md-sys-color-error,#ffb4ab); color:var(--md-sys-color-error,#ffb4ab); }
    .warning { margin-top:16px; padding:14px; border:1px solid var(--lfc-glass-border,#45414c); border-radius:12px; }
    dialog { width:min(540px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto; margin:auto; padding:24px;
      color:inherit; border:1px solid var(--lfc-glass-border,#45414c); border-radius:20px; background:var(--md-sys-color-surface-container,#222127); }
    dialog::backdrop { background:rgb(0 0 0 / 65%); } dialog p { margin:14px 0; } dialog label { display:block; font-size:13px; margin-top:18px; }
    dialog .actions { justify-content:flex-end; } .error { color:var(--md-sys-color-error,#ffb4ab); }
    @media(max-width:520px) { .operation { grid-template-columns:1fr; gap:12px; } .operation button { justify-self:start; } .heading { flex-wrap:wrap; } }
  `]
  render() {
    const network = getSelectedNetwork()
    const locking = Boolean(navigator.locks?.request)
    const selected = this.action ? storageOperation(this.action, this.#networkKey || network.key) : null
    return html`<main>
      <header class="heading"><div><span class="eyebrow">Preferences</span><h1>Settings</h1><p class="muted">Manage this browser’s local node storage.</p></div>
        <button class="secondary" ?disabled=${this.loading} @click=${this.#refresh}>${this.loading ? 'Reading…' : 'Refresh'}</button></header>
      <section class="card"><div class="section-title"><h2>Browser storage</h2><span class="badge">${network.label}</span></div>
        <p class="muted">Usage is a browser estimate for this entire site, including application files. The records below belong only to ${network.label}.</p>
        <div class="storage-numbers"><div><span class="muted">Site storage used</span><strong>${this.#bytes(this.overview?.usage)}</strong></div><div><span class="muted">Browser quota</span><strong>${this.#bytes(this.overview?.quota)}</strong></div></div>
        <ul class="store-list">${this.overview?.stores.map(store => html`<li><code>${store.name}</code><span>${store.truncated ? '≥ ' : ''}${store.count} ${store.count === 1 ? 'record' : 'records'}</span></li>`)}</ul>
      </section>
      <section class="card"><h2>Local data management</h2>
        <p class="muted">Wallet, identity, password, address book and chat are not deleted. Other networks stay untouched. No backup is made.</p>
        <div class="operation"><div><h3>Remove local blocks and resync</h3><p class="muted">Clears blocks together with their local transactions, contract state, checkpoints, nonces and pending pool. Clearing blocks alone would leave invalid references. Unlock afterward to synchronize from compatible peers.</p></div>
          <button class="danger" data-action="chain" ?disabled=${!locking || this.scheduling} @click=${() => this.#open('chain')}>Remove local blocks</button></div>
        <div class="operation"><div><h3>Clear pending transactions</h3><p class="muted">Removes only this browser’s pending pool. Already-broadcast transactions can still be confirmed by the network; this does not cancel them.</p></div>
          <button class="secondary" data-action="pool" ?disabled=${!locking || this.scheduling} @click=${() => this.#open('pool')}>Clear pending pool</button></div>
        <p class="muted warning">The page reloads first to stop its node and workers. Close other Leofcoin node tabs before continuing. A partial failure blocks node startup until the operation succeeds.</p>
        ${!locking ? html`<p class="error" role="alert">Safe storage locking is unavailable in this browser. Destructive actions are disabled.</p>` : ''}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
      </section>
      <dialog aria-labelledby="storage-confirm-title" @cancel=${(event: Event) => { event.preventDefault(); this.#close() }}>
        <h2 id="storage-confirm-title">${this.action === 'chain' ? 'Remove local chain data?' : 'Clear the local pending pool?'}</h2>
        <p>Network: <strong>${selected?.network}</strong>. No wallet or identity is removed.</p>
        <p class="muted">${this.action === 'chain' ? 'Local history is discarded without a backup. Recovery requires compatible peers. This is not an on-chain deletion or a new genesis.' : 'This cannot revoke a transaction already shared with peers.'}</p>
        <p class="muted">Stores to clear: ${selected?.stores.join(', ')}</p>
        <form @submit=${this.#confirm}><label>Type <strong>${this.#phrase}</strong> to confirm
          <input aria-label="Storage confirmation" autocomplete="off" .value=${this.confirmation} @input=${event => this.confirmation = event.target.value}></label>
          ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
          <div class="actions"><button type="button" class="secondary" ?disabled=${this.scheduling} @click=${this.#close}>Cancel</button>
            <button type="submit" class="danger" ?disabled=${this.scheduling || this.confirmation !== this.#phrase}>${this.scheduling ? 'Reloading…' : 'Confirm and reload'}</button></div>
        </form>
      </dialog>
    </main>`
  }
}

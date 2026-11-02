import { LitElement, html } from 'lit'
import { state } from 'lit/decorators.js'
import { ledgerStyles } from './ledger-styles.js'
import { getExplorerSource } from '../../controllers/public-explorer.js'
import { PAGE_SIZE, readBlockPage, transactionReferences, readTransactionRows, readPoolReferences,
  explorerLink, shortId, nativeMovement, formatLfc, compactLfc } from '../../controllers/explorer-data.js'

const age = (timestamp: unknown) => {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || !value) return '—'
  const seconds = Math.round((Date.now() - value) / 1000)
  if (seconds < 0) return 'In the future'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export class ExplorerLedgerList extends LitElement {
  get mode() { return 'blocks' }
  @state() accessor loading = false
  @state() accessor error = ''
  @state() accessor filter = ''
  @state() accessor rows: any[] = []
  @state() accessor page: any = { blocks: [], tip: -1, start: 0, end: -1, missing: 0 }
  @state() accessor anchor: number | null = null
  @state() accessor offset = 0
  @state() accessor references: any[] = []
  @state() accessor hasNewData = false
  @state() accessor truncated = false
  @state() accessor publicMode = false
  @state() accessor sourceLabel = ''
  @state() accessor nativeToken = ''
  #cachedPage: { source: unknown; anchor: number | null; page: any } | undefined
  #subscriptions: Array<() => void> = []
  #request = 0

  connectedCallback() {
    super.connectedCallback()
    const bus = globalThis.pubsub
    if (bus) {
      for (const event of ['block-loaded', 'transaction-processed', 'node:ready', 'explorer:source-ready']) {
        let attached = false
        const handler = () => {
          if (!attached) return
          if (event === 'node:ready' || event === 'explorer:source-ready') void this.load(true)
          else this.hasNewData = true
        }
        bus.subscribe(event, handler)
        attached = true
        this.#subscriptions.push(() => bus.unsubscribe(event, handler, { keepValue: true }))
      }
    }
    void this.load(true)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.#request++
    this.loading = false
    for (const unsubscribe of this.#subscriptions.splice(0)) unsubscribe()
  }

  async load(latest = false) {
    if (this.loading) return
    const request = ++this.#request
    if (latest) { this.anchor = null; this.offset = 0; this.#cachedPage = undefined; this.hasNewData = false }
    this.loading = true
    this.error = ''
    this.filter = ''
    try {
      const source = await getExplorerSource()
      if (request !== this.#request) return
      this.publicMode = source.kind === 'public'
      this.sourceLabel = source.label
      this.nativeToken = source.chain.nativeToken
      if (this.mode === 'pool') {
        if (latest || !this.references.length) {
          const result = await readPoolReferences(source.transactionPoolStore)
          if (request !== this.#request) return
          this.references = result.references
          this.truncated = result.truncated
        }
        const rows = await readTransactionRows(this.references.slice(this.offset, this.offset + PAGE_SIZE), source)
        if (request === this.#request) this.rows = rows
      } else {
        const page = this.#cachedPage?.source === source.chain && this.#cachedPage.anchor === this.anchor
          ? this.#cachedPage.page : await readBlockPage(source.chain, this.anchor)
        if (request !== this.#request) return
        this.#cachedPage = { source: source.chain, anchor: this.anchor, page }
        this.page = page
        if (this.mode === 'blocks') this.rows = page.blocks
        else {
          this.references = transactionReferences(page.blocks)
          const rows = await readTransactionRows(this.references.slice(this.offset, this.offset + PAGE_SIZE), source)
          if (request === this.#request) this.rows = rows
        }
      }
    } catch (error) {
      if (request === this.#request) {
        this.error = error instanceof Error ? error.message : String(error)
        this.rows = []
      }
    } finally { if (request === this.#request) this.loading = false }
  }

  get hasOlder() {
    return this.mode === 'pool' ? this.offset + PAGE_SIZE < this.references.length
      : this.mode === 'transactions' && this.offset + PAGE_SIZE < this.references.length || this.page.start > 0
  }
  get hasNewer() { return this.offset > 0 || this.mode !== 'pool' && this.anchor !== null && this.page.end < this.page.tip }

  async #paginate(older: boolean) {
    if (this.loading) return
    if (this.mode === 'pool' || this.mode === 'transactions' && (older ? this.offset + PAGE_SIZE < this.references.length : this.offset > 0)) {
      this.offset += older ? PAGE_SIZE : -PAGE_SIZE
    } else {
      this.anchor = older ? this.page.start - 1 : Math.min(this.page.tip, this.page.end + PAGE_SIZE)
      this.offset = 0
    }
    await this.load()
    this.scrollTop = 0
    this.shadowRoot.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }

  #blockRows(rows: any[]) {
    return html`<table><thead><tr><th scope="col">Block</th><th scope="col" class="optional">Age</th><th scope="col" class="numeric">Transactions</th><th scope="col" class="numeric optional">Validators</th><th scope="col" class="numeric">Fees · LFC</th><th scope="col" class="numeric optional">Reward · LFC</th></tr></thead>
      <tbody>${rows.map(block => html`<tr>
        <td><a href=${explorerLink('block', { selected: block.hash, index: block.index })}>#${block.index.toLocaleString()}</a><br/><code class="muted row-hash" title=${block.hash}>${shortId(block.hash)}</code></td>
        <td class="optional" title=${new Date(Number(block.timestamp)).toLocaleString()}>${age(block.timestamp)}</td>
        <td class="numeric"><a href=${explorerLink('block', { selected: block.hash, index: block.index })}>${block.transactions.length.toLocaleString()}</a></td>
        <td class="numeric optional">${block.validators.length}</td>
        <td class="numeric"><span title=${`${formatLfc(block.fees)} LFC`}>${compactLfc(block.fees)}</span></td>
        <td class="numeric optional" title=${`${formatLfc(block.reward)} LFC`}>${compactLfc(block.reward)}</td>
      </tr>`)}</tbody></table>`
  }

  #transactionRows(rows: any[]) {
    return html`<table><thead><tr><th scope="col">Transaction</th><th scope="col">Method</th><th scope="col" class="optional">From</th><th scope="col" class="optional">To / recipient</th><th scope="col">${this.mode === 'pool' ? 'State' : 'Block'}</th><th scope="col" class="numeric">Amount · LFC</th></tr></thead>
      <tbody>${rows.map(row => {
        const tx = row.transaction
        const movement = nativeMovement(tx, this.nativeToken)
        const params = { selected: row.hash, ...(row.blockHash ? { blockHash: row.blockHash, blockIndex: String(row.blockIndex) } : {}) }
        return html`<tr>
          <td>${row.hash ? html`<a href=${explorerLink('transaction', params)}><code class="row-hash" title=${row.hash}>${shortId(row.hash)}</code></a>` : 'Unavailable'}<br/><span class="muted">${tx ? age(tx.timestamp) : 'Transaction body unavailable'}</span></td>
          ${row.error ? html`<td colspan="5" class="error">${row.error}</td>` : html`
            <td><span class="badge">${tx.method || 'Contract creation'}</span></td>
            <td class="optional"><code title=${tx.from}>${shortId(tx.from)}</code></td>
            <td class="optional"><code title=${String(movement?.recipient || tx.to)}> ${shortId(movement?.recipient || tx.to)}</code></td>
            <td>${this.mode === 'pool' ? html`<span class="badge">${this.publicMode ? 'Pending at source' : 'Pending locally'}</span>` : html`<a href=${explorerLink('block', { selected: row.blockHash, index: row.blockIndex })}>#${row.blockIndex}</a>`}</td>
            <td class="numeric" title=${movement ? `${formatLfc(movement.units)} LFC` : 'Not a recognized native-token movement'}>${movement ? compactLfc(movement.units) : '—'}</td>`}
        </tr>`
      })}</tbody></table>`
  }

  static styles = ledgerStyles

  render() {
    const pool = this.mode === 'pool'
    const title = this.mode === 'blocks' ? 'Blocks' : pool ? 'Transaction pool' : 'Transactions'
    const filter = this.filter.trim().toLowerCase()
    const rows = this.rows.filter(row => `${row.hash} ${row.index ?? ''} ${row.transaction?.from ?? ''} ${row.transaction?.to ?? ''} ${row.transaction?.method ?? ''}`.toLowerCase().includes(filter))
    return html`<main>
      <header class="heading"><div><span class="eyebrow">${this.sourceLabel || 'Connecting to a read-only source'}</span><h1 tabindex="-1">${title}</h1>
        <p>${pool ? 'Pending transactions observed by the source node. Inclusion is not guaranteed.' : this.mode === 'blocks' ? 'Browse blocks by their exact, zero-based chain index.' : 'Transaction bodies resolved from the displayed block range.'}</p></div>
        <button ?disabled=${this.loading} @click=${() => this.load(true)}>${this.loading ? 'Loading…' : this.hasNewData ? 'New activity · Refresh' : '↻ Refresh latest'}</button></header>
      ${!pool && this.page.missing ? html`<p class="warning">${this.page.missing} blocks in this range are not available locally. This view may be incomplete while the node is syncing.</p>` : ''}
      ${this.truncated ? html`<p class="warning">Only the first 100 local pool entries are shown. Refresh to re-read the pool.</p>` : ''}
      <section class="panel" aria-label=${title} aria-busy=${String(this.loading)}>
        <div class="toolbar"><div><h2>${pool ? 'Pending at source' : 'Ledger entries'}</h2><p>${pool ? `${this.references.length}${this.truncated ? '+' : ''} sampled entries` : this.page.end >= 0 ? `Block range #${this.page.end.toLocaleString()} – #${this.page.start.toLocaleString()}` : 'Waiting for node data'}</p></div>
          <input type="search" aria-label="Filter this page" placeholder=${this.mode === 'blocks' ? 'Filter this page by index or hash' : 'Filter this page by hash, account or method'} .value=${this.filter} @input=${(event: Event) => { this.filter = (event.target as HTMLInputElement).value }} /></div>
        ${this.loading ? html`<div class="state" role="status"><span aria-hidden="true">◌</span><h2>Reading node data…</h2><p>Checking the current source snapshot.</p></div>`
          : this.error ? html`<div class="state" role="alert"><h2>Unable to load ${title.toLowerCase()}</h2><p class="error">${this.error}</p><button @click=${() => this.load(true)}>Try again</button></div>`
          : !rows.length ? html`<div class="state"><span aria-hidden="true">◇</span><h2>${filter ? 'No matching entries on this page' : pool ? 'The local pool is empty' : 'No entries in this range'}</h2><p>${filter ? 'Try another filter, or browse an older range.' : pool ? 'Pending transactions will appear after this node receives them.' : 'No data was returned for this local chain range.'}</p></div>`
          : html`<div class="table-scroll" tabindex="0" role="region" aria-label=${`${title} table`}>${this.mode === 'blocks' ? this.#blockRows(rows) : this.#transactionRows(rows)}</div>`}
        <footer><span class="muted" role="status">${rows.length} shown · ${pool ? 'not confirmed' : this.mode === 'transactions' ? `${this.references.length} transaction references in this range` : this.publicMode ? 'public-node snapshot' : 'local canonical snapshot'}</span><div class="buttons"><button ?disabled=${this.loading || !!this.error || !this.hasNewer} @click=${() => this.#paginate(false)}>← Newer</button><button ?disabled=${this.loading || !!this.error || !this.hasOlder} @click=${() => this.#paginate(true)}>Older →</button></div></footer>
      </section>
      <p class="muted">Filters apply to the loaded page only. ${this.publicMode ? 'Data is reported by a public endpoint, not independently validated by this browser.' : pool ? 'The pool is node-local; other nodes may see a different set.' : 'Data reflects this node’s applied chain. It is not an independent proof of network finality.'} Amounts are only labelled LFC for the native-token contract.</p>
    </main>`
  }
}

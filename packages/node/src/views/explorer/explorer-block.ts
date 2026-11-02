import { css, html, LiteElement, customElement, property } from '@vandeurenglenn/lite'
import { formatBytes } from '@leofcoin/utils'
import { BlockMessage } from '@leofcoin/messages'
import type Peernet from '@leofcoin/peernet'
import { readBlockContent, readTransactionRows, transactionReferences, explorerLink, PAGE_SIZE, formatLfc, compactLfc } from '../../controllers/explorer-data.js'
import { getExplorerSource } from '../../controllers/public-explorer.js'

declare global {
  var peernet: Peernet
}

const short = (input: unknown) => { const value = String(input ?? '—'); return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value }
const relativeTime = (timestamp: number) => {
  const seconds = (timestamp - Date.now()) / 1000
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return formatter.format(Math.round(seconds), 'second')
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86400), 'day')
}

@customElement('explorer-block')
export class ExplorerBlock extends LiteElement {
  @property({ type: Object }) accessor block: ReturnType<BlockMessage['decode']> | undefined
  @property({ type: String }) accessor selected = ''
  @property({ type: Number }) accessor size = 0
  @property({ type: String }) accessor error = ''
  @property({ type: String }) accessor copyStatus = ''
  @property({ type: String }) accessor hash = ''
  @property({ type: Array }) accessor transactionRows: any[] = []
  @property({ type: Number }) accessor transactionOffset = 0
  @property({ type: Boolean }) accessor transactionsLoading = false
  @property({ type: String }) accessor sourceLabel = ''
  #source

  #request = 0

  async onChange(propertyKey: string): Promise<void> {
    if (propertyKey === 'selected' && this.selected) await this.loadBlock()
  }

  async loadBlock() {
    const request = ++this.#request
    this.block = undefined
    this.error = ''
    this.copyStatus = ''
    try {
      const source = await getExplorerSource()
      const block = await readBlockContent(this.selected, source.peernet)
      if (request !== this.#request) return
      this.size = block.size
      this.hash = block.hash
      this.block = block
      this.#source = source
      this.sourceLabel = source.label
      void this.loadTransactions(0)
    } catch (error) {
      if (request !== this.#request) return
      this.error = error instanceof Error ? error.message : String(error)
    }
  }

  async loadTransactions(offset: number) {
    const block = this.block
    if (!block) return
    const request = this.#request
    this.transactionsLoading = true
    this.transactionOffset = offset
    const references = transactionReferences([{ ...block, hash: this.hash }]).sort((a, b) => a.position - b.position)
    const rows = await readTransactionRows(references.slice(offset, offset + PAGE_SIZE), this.#source)
    if (request !== this.#request) return
    this.transactionRows = rows
    this.transactionsLoading = false
  }

  async #copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      this.copyStatus = `${label} copied.`
    } catch (error) {
      this.copyStatus = `Could not copy ${label.toLowerCase()}: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  #identifier(label: string, value: string) {
    return html`<div class="identifier">
      <span>${label}</span>
      <code title=${value}>${value}</code>
      <button aria-label=${`Copy ${label.toLowerCase()}`} @click=${() => this.#copy(value, label)}>Copy</button>
    </div>`
  }

  render() {
    const block = this.block
    return html`
      <main>
        <nav aria-label="Block navigation">
          <a href="#!/explorer/blocks">← All blocks</a>
          ${block && Number(block.index) > 0 && block.previousHash
            ? html`<a href=${`#!/explorer/block?selected=${encodeURIComponent(String(block.previousHash))}`}>Previous block ←</a>`
            : ''}
        </nav>
        ${this.error ? html`<section role="alert" class="state">
          <h1>Unable to load block</h1><p>${this.error}</p>
          <button @click=${() => this.loadBlock()}>Try again</button>
        </section>` : !block ? html`<section class="state" role="status" aria-busy="true">
          <div class="loader"></div><p>Loading block...</p>
        </section>` : html`
          <header>
            <svg class="block-art" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M32 5 56 19v27L32 60 8 46V19Z" fill="currentColor" opacity=".12"/>
              <path d="m8 19 24 14 24-14M32 33v27M32 5 56 19v27L32 60 8 46V19Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="m20 12 24 14v13" stroke="currentColor" stroke-width="2" opacity=".5"/>
            </svg>
            <div><span class="eyebrow">BLOCK DETAILS</span><h1>Block #${String(block.index)}</h1>
              <p><time datetime=${new Date(Number(block.timestamp)).toISOString()}>${relativeTime(Number(block.timestamp))}</time><span> · ${new Date(Number(block.timestamp)).toLocaleString()}</span></p>
              <p>${this.sourceLabel} · Hash-verified content · Network finality not checked</p>
            </div>
          </header>
          <section class="metrics" aria-label="Block summary">
            <article><span>Transactions</span><strong>${block.transactions.length.toLocaleString()}</strong></article>
            <article><span>Validators</span><strong>${block.validators.length.toLocaleString()}</strong></article>
            <article><span>Fees</span><strong title=${`${formatLfc(block.fees)} LFC`}>${compactLfc(block.fees)} <small>LFC</small></strong></article>
            <article><span>Reward</span><strong title=${`${formatLfc(block.reward)} LFC`}>${compactLfc(block.reward)} <small>LFC</small></strong></article>
          </section>
          <section class="panel">
            <h2>Block identity</h2>
            ${this.#identifier('Block hash', this.hash)}
            ${this.#identifier('Previous hash', String(block.previousHash))}
            ${block.producer ? this.#identifier('Producer', String(block.producer)) : ''}
            <dl><div><dt>Encoded size</dt><dd>${formatBytes(this.size)}</dd></div>
              <div><dt>Protocol version</dt><dd>${String(block.protocolVersion) || 'Not recorded'}</dd></div>
              <div><dt>Exact block fees</dt><dd>${formatLfc(block.fees)} LFC</dd></div></dl>
            <p class="feedback" role="status" aria-live="polite">${this.copyStatus}</p>
          </section>
          <section class="panel">
            <div class="section-heading"><h2>Transactions</h2><span class="badge">${block.transactions.length}</span></div>
            ${this.transactionsLoading ? html`<p role="status">Loading transaction bodies…</p>` : block.transactions.length ? html`<div class="table-scroll" tabindex="0" role="region" aria-label="Block transactions">
              <table><thead><tr><th scope="col">Transaction</th><th scope="col">From</th><th scope="col">To / contract</th><th scope="col">Method</th></tr></thead>
                <tbody>${this.transactionRows.map(row => html`<tr>
                  <td>${row.hash ? html`<a href=${explorerLink('transaction', { selected: row.hash, blockIndex: String(block.index), blockHash: this.hash })}><code title=${row.hash}>${short(row.hash)}</code></a>` : row.position + 1}</td>
                  ${row.error ? html`<td colspan="3">${row.error}</td>` : html`<td><code title=${row.transaction.from}>${short(row.transaction.from)}</code></td>
                  <td><code title=${row.transaction.to}>${short(row.transaction.to)}</code></td>
                  <td><span class="method">${row.transaction.method || 'Contract creation'}</span></td>`}
                </tr>`)}</tbody>
              </table></div>` : html`<div class="empty"><span aria-hidden="true">◇</span><h3>No transactions</h3><p>This block contains no transactions.</p></div>`}
            ${block.transactions.length > PAGE_SIZE ? html`<div class="section-heading"><button ?disabled=${this.transactionsLoading || this.transactionOffset === 0} @click=${() => this.loadTransactions(this.transactionOffset - PAGE_SIZE)}>← Previous transactions</button><span>${this.transactionOffset + 1}–${Math.min(this.transactionOffset + PAGE_SIZE, block.transactions.length)} of ${block.transactions.length}</span><button ?disabled=${this.transactionsLoading || this.transactionOffset + PAGE_SIZE >= block.transactions.length} @click=${() => this.loadTransactions(this.transactionOffset + PAGE_SIZE)}>Next transactions →</button></div>` : ''}
          </section>
          <section class="panel">
            <div class="section-heading"><h2>Validators</h2><span class="badge">${block.validators.length}</span></div>
            ${block.validators.length ? html`<ul>${block.validators.map((validator, index) => html`<li>
              <span class="badge">${index + 1}</span><code title=${validator.address}>${short(validator.address)}</code>
              <button aria-label=${`Copy validator ${index + 1} address`} @click=${() => this.#copy(validator.address, 'Validator address')}>Copy</button>
            </li>`)}</ul>` : html`<div class="empty"><h3>No validators recorded</h3><p>This block has no validator entries.</p></div>`}
          </section>
        `}
      </main>
    `
  }

  static styles = [css`
    :host { display: block; width: 100%; min-width: 0; height: 100%; overflow-y: auto; color: var(--md-sys-color-on-surface); box-sizing: border-box; }
    * { box-sizing: border-box; }
    main { width: 100%; min-width: 0; max-width: 1100px; margin: 0 auto; padding: 24px; }
    nav, header, .section-heading, li { display: flex; align-items: center; gap: 14px; }
    nav { justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; }
    a { color: var(--md-sys-color-primary); text-decoration: none; font-size: 14px; }
    a:hover { text-decoration: underline; }
    header { margin-bottom: 24px; }
    .block-art { width: 64px; flex-shrink: 0; color: var(--md-sys-color-primary); }
    .eyebrow { font-size: 11px; letter-spacing: .15em; color: var(--md-sys-color-primary); font-weight: 700; }
    h1 { font-size: clamp(24px, 4vw, 36px); margin: 6px 0; overflow-wrap: anywhere; }
    h2 { font-size: 17px; margin: 0 0 18px; }
    h3 { font-size: 15px; margin: 8px 0; }
    p { margin: 6px 0; color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.6; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    article, .panel { background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 18px; padding: 20px; }
    article { border-top: 3px solid var(--md-sys-color-primary); min-width: 0; }
    article:nth-child(2) { border-color: var(--md-sys-color-secondary); }
    article:nth-child(4) { border-color: var(--md-sys-color-tertiary); }
    article > span { font-size: 12px; color: var(--md-sys-color-on-surface-variant); }
    strong { display: block; font-size: 24px; margin-top: 10px; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
    small { font-size: 11px; font-weight: 500; }
    .panel { margin-bottom: 16px; }
    .identifier { display: grid; grid-template-columns: 105px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
    .identifier > span, dt { font-size: 12px; color: var(--md-sys-color-on-surface-variant); }
    code { font-size: 12px; overflow-wrap: anywhere; min-width: 0; }
    button { border: 1px solid var(--md-sys-color-outline-variant); border-radius: 10px; background: transparent; color: var(--md-sys-color-primary); min-height: 44px; padding: 8px 14px; cursor: pointer; font: inherit; font-size: 13px; }
    button:hover { background: var(--md-sys-color-secondary-container); }
    :focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 3px; }
    dl { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 0; }
    dd { margin: 6px 0 0; font-size: 14px; }
    .feedback:empty { display: none; }
    .section-heading { margin-bottom: 16px; }
    .section-heading h2 { margin: 0; }
    .badge, .method { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); border-radius: 8px; padding: 4px 8px; font-size: 12px; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { font-size: 11px; color: var(--md-sys-color-on-surface-variant); font-weight: 500; }
    th, td { padding: 14px 8px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
    td code { white-space: nowrap; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 8px 0; }
    li code { flex: 1; }
    .empty, .state { padding: 28px 12px; text-align: center; }
    .empty > span { font-size: 32px; color: var(--md-sys-color-primary); }
    .loader { width: 32px; height: 32px; margin: auto; border: 3px solid var(--md-sys-color-outline-variant); border-top-color: var(--md-sys-color-primary); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .loader { animation: none; } }
    @media (max-width: 700px) {
      main { padding: 16px 12px; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      article, .panel { padding: 14px; }
      .identifier { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
      .identifier > span { grid-column: 1 / -1; }
      strong { font-size: 20px; }
    }
  `]
}

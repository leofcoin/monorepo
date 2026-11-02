import { LitElement, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ledgerStyles } from '../../elements/explorer/ledger-styles.js'
import { getExplorerSource } from '../../controllers/public-explorer.js'
import { readTransaction, boundedRead, transactionReferences, nativeMovement, formatLfc, compactLfc, explorerLink, stringify } from '../../controllers/explorer-data.js'

@customElement('explorer-transaction')
export class ExplorerTransaction extends LitElement {
  @property() accessor selected = ''
  @property() accessor blockIndex = ''
  @property() accessor blockHash = ''
  @state() accessor transaction: any
  @state() accessor hash = ''
  @state() accessor size = 0
  @state() accessor error = ''
  @state() accessor status = 'Inclusion not checked'
  @state() accessor inclusion: any
  @state() accessor copyStatus = ''
  @state() accessor nativeToken = ''
  @state() accessor sourceLabel = ''
  @state() accessor publicMode = false
  #request = 0

  updated(changed: Map<string, unknown>) {
    if (['selected', 'blockIndex', 'blockHash'].some(key => changed.has(key)) && this.selected) void this.load()
  }

  disconnectedCallback() { super.disconnectedCallback(); this.#request++ }
  connectedCallback() { super.connectedCallback(); if (this.selected && this.hasUpdated) void this.load() }

  async load() {
    const request = ++this.#request
    this.transaction = undefined
    this.error = ''
    this.inclusion = undefined
    this.status = 'Inclusion not checked'
    this.copyStatus = ''
    try {
      const source = await getExplorerSource()
      if (request !== this.#request) return
      this.nativeToken = source.chain.nativeToken
      this.sourceLabel = source.label
      this.publicMode = source.kind === 'public'
      const result = await readTransaction({ hash: this.selected }, source)
      let inclusion
      let status = 'Inclusion not checked'
      if (/^(0|[1-9]\d*)$/.test(String(this.blockIndex)) && Number.isSafeInteger(Number(this.blockIndex)) && source.chain?.getBlocks) {
        const index = Number(this.blockIndex)
        const blocks = await boundedRead(() => source.chain.getBlocks(index, index + 1))
        const block = Array.isArray(blocks) && blocks.find(block => block && Number(block.index) === index)
        if (block && (!this.blockHash || block.hash === this.blockHash)) {
          for (const reference of transactionReferences([block])) {
            const hash = typeof reference.input === 'string' ? reference.input : (await readTransaction(reference, source)).hash
            if (hash === result.hash) { inclusion = block; status = this.publicMode ? 'Reported in public-node block' : 'Recorded in local chain'; break }
          }
        }
        if (!inclusion) status = this.publicMode ? 'Not found in the requested public-node block' : 'Not found in the requested local block'
      } else if (source.transactionPoolStore && await boundedRead(() => source.transactionPoolStore.has(result.hash))) status = this.publicMode ? 'Pending at public node' : 'Pending in local pool'
      if (request !== this.#request) return
      this.transaction = result.transaction
      this.hash = result.hash
      this.size = result.size
      this.inclusion = inclusion
      this.status = status
    } catch (error) { if (request === this.#request) this.error = error instanceof Error ? error.message : String(error) }
  }

  async #copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); this.copyStatus = `${label} copied.` }
    catch { this.copyStatus = `Could not copy ${label.toLowerCase()}. Check clipboard permission.` }
  }

  #field(label: string, value: unknown, copy = false) {
    return html`<div><dt>${label}</dt><dd><code>${String(value ?? '—')}</code></dd>${copy ? html`<button aria-label=${`Copy ${label.toLowerCase()}`} @click=${() => this.#copy(String(value), label)}>Copy</button>` : ''}</div>`
  }

  static styles = ledgerStyles

  render() {
    const tx = this.transaction
    const movement = nativeMovement(tx, this.nativeToken)
    return html`<main><a href="#!/explorer/transactions">← All transactions</a>
      ${this.error ? html`<section class="panel state" role="alert"><h1>Unable to load transaction</h1><p class="error">${this.error}</p><button @click=${() => this.load()}>Try again</button></section>`
      : !tx ? html`<section class="panel state" role="status" aria-busy="true"><h2>Loading transaction…</h2><p>Reading and checking the requested hash.</p></section>`
      : html`<header class="heading"><div><span class="eyebrow">${this.sourceLabel} · Transaction details</span><h1>${tx.method || 'Contract creation'}</h1><p><span class="badge">${this.status}</span></p></div></header>
        <section class="metrics"><article class="panel metric"><span class="muted">Native movement</span><strong title=${movement ? `${formatLfc(movement.units)} LFC` : 'No recognized native-token movement'}>${movement ? `${compactLfc(movement.units)} LFC` : '—'}</strong></article><article class="panel metric"><span class="muted">Encoded size</span><strong>${this.size.toLocaleString()} bytes</strong></article><article class="panel metric"><span class="muted">Nonce</span><strong>${tx.nonce ?? 'Not recorded'}</strong></article></section>
        <section class="panel detail"><h2>Transaction identity</h2><dl class="fields">
          ${this.#field('Transaction hash', this.hash, true)}${this.#field('From', tx.from, true)}${this.#field('To / contract', tx.to, true)}${movement?.recipient ? this.#field('Token recipient', movement.recipient, true) : ''}
          ${this.#field('Method', tx.method || 'Contract creation')}${this.#field('Timestamp', new Date(Number(tx.timestamp)).toLocaleString())}
          ${movement ? this.#field('Exact native amount', `${formatLfc(movement.units)} LFC`) : ''}
          ${this.inclusion ? html`<div><dt>${this.publicMode ? 'Reported block' : 'Local block'}</dt><dd><a href=${explorerLink('block', { selected: this.inclusion.hash, index: String(this.inclusion.index) })}>#${String(this.inclusion.index)}</a></dd></div>` : ''}
          <div><dt>Fee paid</dt><dd>Not recorded in the transaction payload. The block view shows total block fees.</dd></div>
        </dl><p role="status" class="muted">${this.copyStatus}</p></section>
        <section class="panel detail"><h2>Call parameters</h2><pre>${stringify(tx.params || [])}</pre></section>
        <p class="muted">The content hash is checked before display. A local block reference is not an independent proof of finality. Unknown token amounts are not presented as LFC.</p>`}
    </main>`
  }
}

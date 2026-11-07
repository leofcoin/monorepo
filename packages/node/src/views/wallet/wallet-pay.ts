import { LitElement, html, css } from 'lit'
import { property, customElement, state } from 'lit/decorators.js'
import { parseUnits } from '@leofcoin/utils'
import { createTransferPreview, prepareTransfer, submitTransfer, errorMessage, networkStatus } from '../../controllers/transfer.js'
import { saveActivity } from '../../controllers/activity.js'
import { getSelectedNetwork } from '../../network-selection.js'
import QrScanner from 'qr-scanner'
import '../../elements/payment-recipient.js'

@customElement('wallet-pay')
export class WalletPay extends LitElement {
  static get expectedNetwork() { return getSelectedNetwork().network }
  @property({ type: Object }) accessor wallet: any
  @property() accessor amount = ''
  @property() accessor to = ''
  @property() accessor description = ''
  @property() accessor protocol = ''
  @property() accessor requestInput = ''
  @property({ type: Boolean }) accessor submitting = false
  @property() accessor validationError = ''
  @property({ type: Boolean }) accessor scannerOpen = false
  @property() accessor paymentState: 'entry' | 'review' | 'submitted' | 'confirmed' | 'failed' = 'entry'
  @property() accessor txHash = ''
  @property() accessor requestedNetwork = ''
  @state() accessor preview: any = { state: 'idle' }
  #scanner?: QrScanner
  #timer?: ReturnType<typeof setInterval>
  #preview = createTransferPreview(value => { this.preview = value })

  get #networkMismatch() { return Boolean(this.requestedNetwork && this.requestedNetwork !== WalletPay.expectedNetwork) }
  get #busy() { return this.submitting || this.paymentState === 'submitted' }
  get #canPay() {
    const quote = this.preview.quote
    if (this.#busy || this.#networkMismatch || this.preview.state !== 'ready' || !quote?.affordable) return false
    try { return quote.from === this.wallet?.selectedAccount && quote.to === this.to && parseUnits(quote.amount) === parseUnits(this.amount) }
    catch { return false }
  }
  #short(value = '') { return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value || 'Not selected' }
  #options() { return { chain: globalThis.chain, peernet: globalThis.peernet, identity: globalThis.identityController,
    from: this.wallet?.selectedAccount, to: this.to, amount: this.amount } }

  connectedCallback() {
    super.connectedCallback()
    this.#timer = setInterval(() => {
      if (this.paymentState === 'review' && !this.#busy && this.preview.state !== 'loading') void this.#updatePreview()
    }, 5000)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this.#timer)
    this.#preview.cancel()
    this.#stopScanner()
  }
  updated(changed) {
    if (['amount', 'to', 'wallet', 'requestedNetwork'].some(key => changed.has(key))) void this.#updatePreview()
  }
  async #updatePreview() {
    this.#preview.cancel()
    if (this.#networkMismatch || !this.to || !this.amount || this.paymentState !== 'review' || this.#busy) {
      this.preview = { state: 'idle' }
      return
    }
    await this.#preview.update(this.#options())
  }
  #reset = () => {
    if (this.#busy) return
    this.#preview.cancel()
    this.requestInput = ''; this.to = ''; this.amount = ''; this.description = ''; this.protocol = ''
    this.requestedNetwork = ''; this.validationError = ''; this.paymentState = 'entry'; this.txHash = ''
    this.preview = { state: 'idle' }; this.#stopScanner()
  }
  #cancel = () => {
    if (this.#busy) return
    this.#reset()
    location.hash = '#!/wallet/send'
  }
  #applyRequest(payload: { to: string; amount?: string; description?: string; protocol?: string; network?: string }) {
    if (this.#busy) return
    this.#preview.cancel(); this.preview = { state: 'idle' }
    this.to = payload.to; this.amount = payload.amount || ''; this.description = payload.description || ''
    this.protocol = payload.protocol || 'manual'; this.requestedNetwork = payload.network || ''
    this.validationError = ''; this.txHash = ''; this.paymentState = 'review'
    void this.#updatePreview()
  }
  applyRouteParameters(params: Record<string, string>) {
    if (!params.to) { this.#reset(); return }
    this.#applyRequest({ to: params.to, amount: params.amount, description: params.description,
      protocol: params.protocol || 'url', network: params.network || params.networkName })
  }
  #parseInput(input: string) {
    if (input.startsWith('{')) {
      const parsed = JSON.parse(input)
      const to = parsed.to || parsed.from
      if (typeof to !== 'string' || !to) throw new Error('Missing recipient address.')
      for (const key of ['amount', 'description', 'network', 'networkName', 'protocol'])
        if (parsed[key] !== undefined && typeof parsed[key] !== 'string') throw new Error(`Invalid ${key} in request.`)
      return { to, amount: parsed.amount, description: parsed.description, protocol: parsed.protocol || 'json', network: parsed.network || parsed.networkName }
    }
    const marker = '#!/wallet/pay?'
    const index = input.indexOf(marker)
    if (index !== -1) {
      const params = new URLSearchParams(input.slice(index + marker.length))
      const to = params.get('to')
      if (!to) throw new Error('Missing recipient address.')
      return { to, amount: params.get('amount') || '', description: params.get('description') || '',
        protocol: params.get('protocol') || 'url', network: params.get('network') || params.get('networkName') || '' }
    }
    return { to: input, amount: this.amount, protocol: 'manual' }
  }
  #parseRequest = () => {
    try {
      if (!this.requestInput.trim()) throw new Error('Enter a recipient or payment link first.')
      this.#applyRequest(this.#parseInput(this.requestInput.trim()))
    } catch (error) { this.validationError = errorMessage(error) }
  }
  #stopScanner = () => { this.#scanner?.stop(); this.#scanner?.destroy(); this.#scanner = undefined; this.scannerOpen = false }
  #startScanner = async () => {
    this.validationError = ''; this.#stopScanner(); this.scannerOpen = true
    await this.updateComplete
    const video = this.shadowRoot.querySelector('video')
    if (!video) return
    this.#scanner = new QrScanner(video, (decoded: string) => {
      this.requestInput = decoded; this.#stopScanner(); this.#parseRequest()
    })
    try { await this.#scanner.start() }
    catch { this.validationError = 'Camera access failed. Paste the address or payment link instead.'; this.#stopScanner() }
  }
  #accept = async () => {
    if (!this.#canPay) return
    const options = this.#options(), reviewed = this.preview.quote, network = WalletPay.expectedNetwork
    this.submitting = true; this.validationError = ''; this.#preview.cancel()
    try {
      const prepared = await prepareTransfer(options)
      if (!this.isConnected || globalThis.chain !== options.chain || this.wallet?.selectedAccount !== options.from || this.to !== options.to || this.amount !== options.amount || WalletPay.expectedNetwork !== network)
        throw new Error('Payment details changed. Review them again before sending.')
      if (!networkStatus(globalThis.chain, globalThis.peernet).ready) throw new Error('Connection lost. Wait for sync before sending.')
      if (parseUnits(prepared.total) > parseUnits(reviewed.total)) throw new Error('The fee increased. Review the payment again before sending.')
      await submitTransfer(options.chain, prepared, event => {
        this.txHash = event.hash || this.txHash
        this.paymentState = event.phase === 'pending' ? 'submitted' : event.phase === 'confirmed' ? 'confirmed' : 'review'
        if (event.hash) saveActivity({ ...prepared, signed: undefined, hash: event.hash, phase: event.phase, timestamp: Date.now() })
      })
    } catch (error) { this.validationError = errorMessage(error); this.paymentState = 'failed' }
    finally { this.submitting = false }
  }

  static styles = css`
    :host { display:block; width:100%; height:100%; min-width:0; box-sizing:border-box; overflow:auto;
      padding:clamp(20px,4vw,44px) 20px; color:var(--md-sys-color-on-surface,#f0edf0); }
    * { box-sizing:border-box; } main { max-width:640px; margin:0 auto; display:grid; gap:24px; }
    h1,p { margin:0; } h1 { font-size:clamp(26px,4vw,34px); letter-spacing:-.04em; font-weight:650; }
    .eyebrow { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--md-sys-color-primary,#b5b9ff); font-weight:700; }
    header { display:grid; gap:9px; } .muted { color:var(--md-sys-color-on-surface-variant,#b8b4be); font-size:13px; line-height:1.6; }
    .card { border:1px solid var(--lfc-glass-border,#3c3942); background:var(--md-sys-color-surface-container,#222127); border-radius:20px; padding:24px; display:grid; gap:24px; }
    .recipient { display:grid; grid-template-columns:42px 1fr; align-items:start; gap:12px; }
    .avatar { width:42px; height:42px; display:grid; place-items:center; border-radius:14px; background:var(--md-sys-color-primary-container,#34365b); color:var(--md-sys-color-on-primary-container,#e2e1ff); font-size:20px; }
    .recipient strong { font-size:14px; display:block; margin:3px 0 7px; } .address { font:12px/1.6 ui-monospace,monospace; overflow-wrap:anywhere; user-select:all; color:var(--md-sys-color-on-surface-variant,#c0bbc6); }
    label { display:grid; gap:10px; font-size:13px; font-weight:600; } input,textarea { width:100%; min-width:0; padding:14px; border-radius:12px; border:1px solid var(--md-sys-color-outline-variant,#55505e); background:var(--md-sys-color-surface,#19181d); color:inherit; font:inherit; }
    .amount { display:flex; align-items:center; border-bottom:1px solid var(--md-sys-color-outline-variant,#45414c); padding:4px 0 16px; gap:12px; }
    .amount input { font-size:clamp(32px,6vw,44px); font-weight:550; letter-spacing:-.04em; padding:0; border:0; background:none; border-radius:0; }
    .amount span { font-size:16px; font-weight:600; color:var(--md-sys-color-on-surface-variant,#c0bbc6); }
    .note { padding:12px 14px; border-left:3px solid var(--md-sys-color-primary,#b5b9ff); background:var(--md-sys-color-surface-container-high,#29272f); border-radius:0 10px 10px 0; font-size:14px; line-height:1.6; overflow-wrap:anywhere; }
    dl { margin:0; display:grid; gap:16px; } dl>div { display:flex; justify-content:space-between; gap:20px; font-size:13px; } dt { color:var(--md-sys-color-on-surface-variant,#c0bbc6); } dd { margin:0; text-align:right; overflow-wrap:anywhere; }
    .total { padding-top:16px; border-top:1px solid var(--md-sys-color-outline-variant,#45414c); font-weight:650; font-size:16px; }
    .notice,.error,.network-warning { font-size:13px; line-height:1.6; padding:12px 14px; border-radius:12px; background:var(--md-sys-color-surface-container-high,#2d2933); overflow-wrap:anywhere; }
    .error,.network-warning { color:var(--md-sys-color-error,#ffb4ab); border:1px solid color-mix(in srgb,var(--md-sys-color-error,#ffb4ab) 30%,transparent); }
    footer { display:flex; gap:12px; align-items:center; position:sticky; bottom:0; z-index:1; padding:12px 0;
      background:var(--md-sys-color-surface-container,#222127); border-top:1px solid var(--md-sys-color-outline-variant,#45414c); }
    footer button { flex:1; } footer button.primary { flex:2; }
    button { cursor:pointer; min-height:46px; padding:10px 18px; border:1px solid var(--md-sys-color-outline-variant,#55505e); border-radius:12px; font-family:inherit; font-size:13px; font-weight:600; background:transparent; color:inherit; }
    button.primary { margin-left:auto; background:var(--md-sys-color-primary,#c1c1ff); border-color:transparent; color:var(--md-sys-color-on-primary,#282759); }
    button:disabled { opacity:.45; cursor:not-allowed; } button.small { min-height:36px; padding:6px 10px; }
    :is(button,input,textarea):focus-visible { outline:2px solid var(--md-sys-color-primary,#c1c1ff); outline-offset:4px; }
    video { width:100%; max-height:260px; border-radius:12px; background:#000; }
    @media(max-width:480px) { :host { padding:20px 12px; } .card { padding:18px; gap:20px; } .recipient { grid-template-columns:36px 1fr; } .recipient button { grid-column:2; justify-self:start; } footer { flex-wrap:wrap; } footer button { flex:1; } }
  `
  render() {
    const quote = this.preview.quote
    const terminal = ['submitted', 'confirmed', 'failed'].includes(this.paymentState)
    return html`<main>
      <header><span class="eyebrow">${getSelectedNetwork().label}</span>
        <h1>${this.paymentState === 'confirmed' ? 'Payment confirmed' : this.paymentState === 'submitted' ? 'Payment sent' : this.paymentState === 'failed' ? 'Payment not completed' : this.paymentState === 'entry' ? 'Make a payment' : 'Review payment'}</h1>
        <p class="muted">${terminal ? this.paymentState === 'submitted' ? 'Waiting for confirmation on the chain. You can keep this page open.' : this.paymentState === 'confirmed' ? 'Your transaction is confirmed on the chain.' : 'No automatic retry. Check the details before trying again.' : 'Check who you’re paying and what will leave your account.'}</p>
      </header>
      ${this.paymentState === 'entry' ? html`<section class="card">
        <label>Recipient or payment link<textarea aria-label="Payment request or recipient address" rows="3" .value=${this.requestInput}
          placeholder="Paste an address or payment link" @input=${event => this.requestInput = event.target.value}></textarea></label>
        <label>Amount (optional)<input aria-label="Payment amount in LFC" inputmode="decimal" .value=${this.amount} placeholder="0.00" @input=${event => this.amount = event.target.value}></label>
        ${this.scannerOpen ? html`<video></video><button @click=${this.#stopScanner}>Stop scanner</button>` : html`<button @click=${this.#startScanner}>Scan QR code</button>`}
        ${this.validationError ? html`<p class="error" role="alert">${this.validationError}</p>` : ''}
        <footer><button @click=${this.#cancel}>Cancel</button><button class="primary" @click=${this.#parseRequest}>Review payment</button></footer>
      </section>` : html`<section class="card">
        <payment-recipient .address=${this.to} .network=${WalletPay.expectedNetwork} .disabled=${this.#busy || this.#networkMismatch}></payment-recipient>
        ${this.description ? html`<p class="note">${this.description}</p>` : ''}
        <label>Amount<div class="amount"><input aria-label="Payment amount in LFC" inputmode="decimal" placeholder="0.00" .value=${this.amount}
          ?disabled=${this.#busy || terminal} @input=${event => { this.#preview.cancel(); this.preview = { state: 'idle' }; this.amount = event.target.value }}><span>LFC</span></div></label>
        <dl><div><dt>From account</dt><dd title=${this.wallet?.selectedAccount || ''}>${this.#short(this.wallet?.selectedAccount)}</dd></div>
          <div><dt>Network</dt><dd>${getSelectedNetwork().label}</dd></div>
          ${!terminal ? html`<div><dt>Available balance</dt><dd>${quote ? `${quote.balance} LFC` : '—'}</dd></div>
            <div><dt>Estimated fee</dt><dd>${quote ? `${quote.fee} LFC` : '—'}</dd></div>
            ` : ''}</dl>
        ${this.#networkMismatch ? html`<div class="network-warning" role="alert">This request targets ${this.requestedNetwork}, but your wallet is on ${WalletPay.expectedNetwork}.</div>` : ''}
        ${!terminal && !this.#networkMismatch ? html`<div aria-live="polite">
          ${this.preview.state === 'loading' ? html`<p class="notice">Checking balance and estimating fee…</p>` : this.preview.state === 'error' ? html`<p class="error">${this.preview.error}</p>` : quote && !quote.affordable ? html`<p class="error">Insufficient balance for the amount and estimated fee.</p>` : !this.amount ? html`<p class="notice">Enter an amount to see the estimated fee.</p>` : quote ? html`<p class="muted">Your wallet signs only after you confirm. A higher exact fee requires another review.</p>` : ''}
        </div>` : ''}
        ${this.validationError ? html`<p class="error" role="alert">${this.validationError}</p>` : ''}
        ${this.txHash ? html`<div><p class="muted">Transaction hash</p><div class="address">${this.txHash}</div></div>` : ''}
        ${terminal ? '' : html`<footer><button ?disabled=${this.#busy} @click=${this.#cancel}>Cancel</button><button class="primary" ?disabled=${!this.#canPay} @click=${this.#accept}>Confirm</button></footer>`}
      </section>`}
    </main>`
  }
}

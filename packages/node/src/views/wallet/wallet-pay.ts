import { LiteElement, html, css, property, customElement } from '@vandeurenglenn/lite'
import { formatUnits, parseUnits } from '@leofcoin/utils'
import { prepareTransfer, submitTransfer, errorMessage } from '../../controllers/transfer.js'
import { saveActivity } from '../../controllers/activity.js'
import './../../elements/hero.js'
import '@vandeurenglenn/lite-elements/typography.js'
import { StyleList } from '@vandeurenglenn/lite/element'
import QrScanner from 'qr-scanner'
import { getSelectedNetwork } from '../../network-selection.js'

@customElement('wallet-pay')
export class WalletPay extends LiteElement {
  static get expectedNetwork() {
    return getSelectedNetwork().network
  }

  @property({ consumer: true })
  accessor wallet

  @property()
  accessor amount: string

  @property()
  accessor to: string

  @property()
  accessor description: string

  @property()
  accessor protocol: string

  @property()
  accessor requestInput = ''

  @property({ type: Boolean })
  accessor submitting = false

  @property()
  accessor validationError = ''

  @property({ type: Boolean })
  accessor scannerOpen = false

  @property()
  accessor paymentState: 'entry' | 'review' | 'submitted' | 'confirmed' | 'failed' = 'entry'

  @property()
  accessor txHash = ''

  @property()
  accessor requestedNetwork = ''

  @property()
  accessor availableBalance = ''

  @property()
  accessor estimatedFee = 'Unavailable'

  @property()
  accessor balanceAfterSend = ''

  #scanner?: QrScanner

  get #hasRequest() {
    return Boolean(this.to)
  }

  get #networkMismatch() {
    return Boolean(this.requestedNetwork && this.requestedNetwork !== WalletPay.expectedNetwork)
  }

  #shortAddress(value?: string) {
    if (!value) return 'Unknown'
    if (value.length <= 14) return value
    return `${value.slice(0, 8)}...${value.slice(-6)}`
  }

  #reset = () => {
    this.requestInput = ''
    this.to = ''
    this.amount = ''
    this.description = ''
    this.protocol = ''
    this.requestedNetwork = ''
    this.validationError = ''
    this.paymentState = 'entry'
    this.txHash = ''
    this.availableBalance = ''
    this.balanceAfterSend = ''
    this.estimatedFee = 'Unavailable'
    this.#stopScanner()
  }

  #applyRequest = (payload: {
    to: string
    amount?: string
    description?: string
    protocol?: string
    network?: string
  }) => {
    this.to = payload.to
    this.amount = payload.amount || ''
    this.description = payload.description || ''
    this.protocol = payload.protocol || 'manual'
    this.requestedNetwork = payload.network || ''
    this.validationError = ''
    this.paymentState = 'review'
    this.#updatePreview()
  }

  async onChange(propertyKey: string): Promise<void> {
    if (propertyKey === 'amount' || propertyKey === 'wallet' || propertyKey === 'to') {
      await this.#updatePreview()
    }
  }

  #formatBaseValue(value: bigint) {
    try {
      return formatUnits(value).toLocaleString()
    } catch {
      return '0'
    }
  }

  #amountBaseValue() {
    if (!this.amount) return 0n
    try {
      return BigInt(parseUnits(this.amount).toString())
    } catch {
      return 0n
    }
  }

  #toBigIntFee(value: unknown): bigint | null {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
    if (typeof value === 'string' && value.trim() !== '') {
      try {
        if (value.includes('.')) return BigInt(parseUnits(value).toString())
        return BigInt(value)
      } catch {
        return null
      }
    }
    return null
  }

  async #updatePreview() {
    const account = this.wallet?.selectedAccount
    if (!account) {
      this.availableBalance = ''
      this.balanceAfterSend = ''
      return
    }

    try {
      const balanceRaw = await client.balanceOf(account, false)
      const currentBalance = BigInt(balanceRaw)
      const sendAmount = this.#amountBaseValue()

      const prepared = await prepareTransfer({
        chain,
        peernet: globalThis.peernet,
        identity: globalThis.identityController,
        from: account,
        to: this.to,
        amount: this.amount
      })
      const estimatedFeeBase = parseUnits(prepared.fee)

      this.availableBalance = this.#formatBaseValue(currentBalance)
      this.estimatedFee = estimatedFeeBase !== null ? `${this.#formatBaseValue(estimatedFeeBase)} LFC` : 'Unavailable'

      const after = currentBalance - sendAmount - (estimatedFeeBase ?? 0n)
      this.balanceAfterSend = this.#formatBaseValue(after > 0n ? after : 0n)
    } catch {
      this.availableBalance = 'Unavailable'
      this.balanceAfterSend = 'Unavailable'
      this.estimatedFee = 'Unavailable'
    }
  }

  #parseInput = (input: string) => {
    if (input.startsWith('{')) {
      const parsed = JSON.parse(input) as {
        to?: string
        from?: string
        amount?: string
        description?: string
        protocol?: string
        network?: string
        networkName?: string
      }
      const to = parsed.to || parsed.from
      if (!to) throw new Error('Missing recipient address')
      return {
        to,
        amount: parsed.amount,
        description: parsed.description,
        protocol: parsed.protocol || 'json',
        network: parsed.network || parsed.networkName
      }
    }

    const hashbangIndex = input.indexOf('#!/wallet/pay?')
    const inlineHashbang = input.startsWith('#!/wallet/pay?')
    const querySource = inlineHashbang
      ? input.slice('#!/wallet/pay?'.length)
      : hashbangIndex > -1
      ? input.slice(hashbangIndex + '#!/wallet/pay?'.length)
      : ''

    if (querySource) {
      const params = new URLSearchParams(querySource)
      const to = params.get('to')
      if (!to) throw new Error('Missing recipient address')
      return {
        to,
        amount: params.get('amount') || undefined,
        description: params.get('description') || undefined,
        protocol: params.get('protocol') || 'url',
        network: params.get('network') || params.get('networkName') || undefined
      }
    }

    return { to: input, protocol: 'manual' }
  }

  #parseRequestInput = () => {
    const input = this.requestInput.trim()
    if (!input) return

    try {
      this.#applyRequest(this.#parseInput(input))
    } catch (error) {
      this.validationError = 'Could not parse request. Paste a valid request URL, JSON payload, or address.'
    }
  }

  #stopScanner = () => {
    this.#scanner?.stop()
    this.#scanner?.destroy()
    this.#scanner = undefined
    this.scannerOpen = false
  }

  #startScanner = async () => {
    this.validationError = ''
    this.scannerOpen = true
    await this.updateComplete
    const video = this.shadowRoot.querySelector('video') as HTMLVideoElement | null
    if (!video) {
      this.validationError = 'Camera preview could not be started.'
      this.scannerOpen = false
      return
    }

    this.#stopScanner()
    this.scannerOpen = true

    this.#scanner = new QrScanner(video, (decoded: string) => {
      this.requestInput = decoded
      this.#stopScanner()
      this.#parseRequestInput()
    })

    try {
      await this.#scanner.start()
    } catch (error) {
      this.validationError = 'Camera access failed. You can still paste a request or address.'
      this.#stopScanner()
    }
  }

  #accept = async () => {
    if (this.submitting || this.paymentState === 'submitted' || this.paymentState === 'confirmed') return
    if (!this.to || !this.amount) {
      this.validationError = 'Recipient and amount are required before you can pay.'
      return
    }

    if (this.#networkMismatch) {
      this.validationError = `Request network mismatch. Expected ${WalletPay.expectedNetwork}, got ${this.requestedNetwork}.`
      return
    }

    this.submitting = true
    this.validationError = ''
    try {
      const prepared = await prepareTransfer({
        chain,
        peernet: globalThis.peernet,
        identity: globalThis.identityController,
        from: this.wallet?.selectedAccount,
        to: this.to,
        amount: this.amount
      })
      await submitTransfer(chain, prepared, (event) => {
        this.txHash = event.hash || this.txHash
        this.paymentState =
          event.phase === 'pending' ? 'submitted' : event.phase === 'confirmed' ? 'confirmed' : 'review'
        if (event.hash)
          saveActivity({ ...prepared, signed: undefined, hash: event.hash, phase: event.phase, timestamp: Date.now() })
      })
      this.submitting = false
    } catch (error) {
      this.submitting = false
      this.paymentState = 'failed'
      this.validationError = errorMessage(error)
    }
  }

  #close = () => {
    this.#stopScanner()
    history.back()
  }

  #copyHash = async () => {
    if (!this.txHash) return
    await navigator.clipboard.writeText(this.txHash)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#stopScanner()
  }

  static styles?: StyleList = [
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
        box-sizing: border-box;
        padding: 24px 16px;
        color: var(--md-sys-color-on-surface, #eee);
      }
      hero-element {
        width: 100%; max-width: var(--lfc-page-width, 720px); margin: auto;
        height: auto; max-height: none; padding: clamp(18px, 3vw, 26px);
        border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 22px;
        background: var(--lfc-glass-surface, #242126);
        color: inherit; backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      }
      input:focus-visible, textarea:focus-visible, button:focus-visible {
        outline: 2px solid var(--md-sys-color-primary, #3477d2); outline-offset: 2px;
      }
      button { min-height: 44px; font: inherit; }
      button:disabled { opacity: .45; cursor: default; }
      flex-column { gap: 12px; }

      input,
      textarea,
      button {
        pointer-events: auto;
        border-color: var(--border-color);
        padding: 10px 12px;
        border-radius: 12px;
        box-sizing: border-box;
      }

      textarea,
      input {
        font-size: 16px;
        width: 100%;
        background: var(--md-sys-color-surface-container-highest);
        color: var(--md-sys-color-on-surface);
      }

      video {
        width: 100%;
        border-radius: 16px;
        border: 1px solid var(--border-color);
        background: #000;
        max-height: 260px;
      }

      button {
        color: var(--md-sys-color-on-surface);
        background: transparent;
        padding: 10px 20px;
        cursor: pointer;
      }

      button:hover {
        background: var(--md-sys-color-surface-container-high);
        transition: 0.25s;
      }

      h5 {
        margin: 0;
      }
      flex-column {
        height: 100%;
      }

      flex-row {
        width: 100%;
        flex-wrap: wrap;
        gap: 8px;
      }

      .protocol {
        padding: 12px 24px;
        display: block;
        border: 1px solid var(--border-color);
        border-radius: 24px;
        width: fit-content;
        margin: 0 auto 16px;
        background-color: var(--md-sys-color-surface-container-high);
      }

      .summary {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 12px;
        box-sizing: border-box;
        background: var(--md-sys-color-surface-container-high);
      }

      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 0;
        align-items: center;
        overflow-wrap: anywhere;
      }
      .summary-row input { width: 60%; }
      @media (prefers-reduced-motion: reduce) { button:hover { transition: none; } }

      .summary-row + .summary-row {
        border-top: 1px solid var(--border-color);
      }

      .error {
        color: var(--md-sys-color-error);
        width: 100%;
      }

      .hint {
        color: var(--md-sys-color-on-surface-variant);
        width: 100%;
      }

      .status {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 14px;
        box-sizing: border-box;
        background: var(--md-sys-color-surface-container-high);
      }

      .hash {
        display: block;
        width: 100%;
        word-break: break-all;
        color: var(--md-sys-color-on-surface-variant);
      }

      .network-warning {
        border: 1px solid var(--md-sys-color-error);
        border-radius: 12px;
        color: var(--md-sys-color-error);
        padding: 8px 10px;
        width: 100%;
        box-sizing: border-box;
      }
    `
  ]

  render() {
    if (this.paymentState === 'submitted' || this.paymentState === 'confirmed' || this.paymentState === 'failed') {
      const headline =
        this.paymentState === 'submitted'
          ? 'Payment submitted'
          : this.paymentState === 'confirmed'
          ? 'Payment confirmed'
          : 'Payment failed'
      const subline =
        this.paymentState === 'submitted'
          ? 'Waiting for chain confirmation...'
          : this.paymentState === 'confirmed'
          ? 'Your transaction is confirmed.'
          : 'Please review details and try again.'

      return html`
        <hero-element .headline=${headline} .subline=${subline}>
          <flex-column>
            <div class="status">
              <custom-typography type="body" size="small">Recipient: ${this.#shortAddress(this.to)}</custom-typography>
              <custom-typography type="body" size="small">Amount: ${this.amount} LFC</custom-typography>
              ${this.txHash ? html`<span class="hash">Hash: ${this.txHash}</span>` : ''}
            </div>

            ${this.validationError ? html`<span class="error">${this.validationError}</span>` : ''}

            <flex-row>
              ${this.paymentState === 'failed'
                ? html`<button @click=${() => (this.paymentState = 'review')}>Back to review</button>`
                : html`
                    <button @click=${this.#copyHash} ?disabled=${!this.txHash}>Copy hash</button>
                    <flex-it></flex-it>
                    <button @click=${this.#close}>Done</button>
                  `}
            </flex-row>
          </flex-column>
        </hero-element>
      `
    }

    if (!this.#hasRequest || this.paymentState === 'entry') {
      return html`
        <hero-element headline="Pay" subline="Scan a QR code or paste a payment request">
          <flex-column>
            ${this.scannerOpen
              ? html`
                  <video></video>
                  <button @click=${this.#stopScanner}>Stop scanner</button>
                `
              : html`<button @click=${this.#startScanner}>Scan QR</button>`}

            <textarea
              aria-label="Payment request or recipient address"
              rows="5"
              placeholder="Paste request URL, JSON payload, or recipient address"
              .value=${this.requestInput}
              @input=${(event: Event) => {
                this.requestInput = (event.target as HTMLTextAreaElement).value
              }}></textarea>

            <span class="hint">You can paste a request from QR sharing or enter an address manually.</span>
            ${this.validationError ? html`<span class="error">${this.validationError}</span>` : ''}

            <flex-row>
              <button @click=${this.#close}>Cancel</button>
              <flex-it></flex-it>
              <button @click=${this.#parseRequestInput}>Review payment</button>
            </flex-row>
          </flex-column>
        </hero-element>
      `
    }

    return html`
      <custom-typography class="protocol" type="body" size="small"
        ><span>source: ${this.protocol || 'manual'}</span></custom-typography
      >
      <hero-element headline="Review payment" .subline=${this.description || 'Confirm details before sending'}>
        <flex-column>
          <div class="summary">
            <div class="summary-row">
              <custom-typography type="body" size="small">Recipient</custom-typography>
              <custom-typography type="body" size="small">${this.#shortAddress(this.to)}</custom-typography>
            </div>
            <div class="summary-row">
              <custom-typography type="body" size="small">Amount</custom-typography>
              <input
                aria-label="Payment amount in LFC"
                inputmode="decimal"
                placeholder="Amount"
                .value=${this.amount || ''}
                @input=${(event: Event) => {
                  this.amount = (event.target as HTMLInputElement).value
                }} />
            </div>
            <div class="summary-row">
              <custom-typography type="body" size="small">From account</custom-typography>
              <custom-typography type="body" size="small"
                >${this.#shortAddress(this.wallet?.selectedAccount)}</custom-typography
              >
            </div>
            <div class="summary-row">
              <custom-typography type="body" size="small">Available balance</custom-typography>
              <custom-typography type="body" size="small"
                >${this.availableBalance || 'Loading...'} LFC</custom-typography
              >
            </div>
            <div class="summary-row">
              <custom-typography type="body" size="small">Estimated fee</custom-typography>
              <custom-typography type="body" size="small">${this.estimatedFee}</custom-typography>
            </div>
            <div class="summary-row">
              <custom-typography type="body" size="small">Balance after send</custom-typography>
              <custom-typography type="body" size="small"
                >${this.balanceAfterSend || 'Loading...'} LFC</custom-typography
              >
            </div>
            <div class="summary-row">
              <custom-typography type="body" size="small">Network</custom-typography>
              <custom-typography type="body" size="small"
                >${this.requestedNetwork || WalletPay.expectedNetwork}</custom-typography
              >
            </div>
          </div>

          ${this.#networkMismatch
            ? html`<div class="network-warning">
                This request targets ${this.requestedNetwork}, but your wallet is on ${WalletPay.expectedNetwork}.
              </div>`
            : ''}
          ${this.validationError ? html`<span class="error">${this.validationError}</span>` : ''}

          <flex-row>
            <button @click=${this.#reset}>Edit</button>
            <flex-it></flex-it>
            <button ?disabled=${this.submitting || !this.amount || this.#networkMismatch} @click=${this.#accept}>
              ${this.submitting ? 'Submitting...' : 'Pay now'}
            </button>
          </flex-row>
        </flex-column>
      </hero-element>
    `
  }
}

import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import './../../elements/hero.js'
import * as qrcode from 'qrcode'
import { write, NFC_SUPPORT } from './../../integrations/nfc.js'
import { getSelectedNetwork } from '../../network-selection.js'

type WalletState = {
  selectedAccount?: string
  selectedAccountIndex?: number
  accounts?: Array<[string, string, string]>
}

@customElement('wallet-receive')
export class WalletReceive extends LitElement {
  @property({ type: Object })
  accessor wallet?: WalletState

  @property()
  accessor amount = ''

  @property()
  accessor note = ''

  @state()
  accessor address = ''

  @state()
  accessor requestUrl = ''

  @state()
  accessor requestText = ''

  @state()
  accessor qrCodeDataUrl = ''

  @state()
  accessor shareSupported = Boolean(navigator.share)
  @state()
  accessor message = ''
  @state()
  accessor qrError = ''
  #requestRevision = 0

  protected willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('wallet')) {
      this.#syncAddressFromWallet()
    }

    if (changedProperties.has('amount') || changedProperties.has('note') || changedProperties.has('address')) {
      this.#buildRequest()
    }
  }

  async #buildRequest() {
    const revision = ++this.#requestRevision
    if (!this.address) {
      this.requestUrl = ''
      this.requestText = ''
      this.qrCodeDataUrl = ''
      this.qrError = ''
      return
    }

    const params = new URLSearchParams({
      to: this.address,
      protocol: 'url',
      network: getSelectedNetwork().network
    })

    if (this.amount) params.set('amount', this.amount)
    if (this.note) params.set('description', this.note)

    this.requestUrl = `${new URL(document.baseURI).origin}${
      new URL(document.baseURI).pathname
    }#!/wallet/pay?${params.toString()}`
    this.requestText = JSON.stringify(
      {
        action: 'pay',
        network: getSelectedNetwork().network,
        to: this.address,
        amount: this.amount || undefined,
        description: this.note || undefined,
        protocol: 'json'
      },
      null,
      2
    )

    try {
      const qrCodeDataUrl = await qrcode.toDataURL(this.requestUrl)
      if (revision === this.#requestRevision) {
        this.qrCodeDataUrl = qrCodeDataUrl
        this.qrError = ''
      }
    } catch {
      if (revision === this.#requestRevision) {
        this.qrCodeDataUrl = ''
        this.qrError = 'The payment QR code could not be generated. You can still copy your address or request link.'
      }
    }
  }

  #syncAddressFromWallet() {
    const account = this.wallet?.selectedAccount || this.wallet?.accounts?.[this.wallet.selectedAccountIndex || 0]?.[1] || ''
    this.address = account
  }

  static styles = [
    css`
      :host {
        width: 100%;
        height: 100%;
        display: block;
        overflow: auto;
        box-sizing: border-box;
        padding: 24px 16px;
        color: var(--md-sys-color-on-surface, #eee);
      }

      main { max-width: var(--lfc-page-width, 720px); margin: auto; }
      h1 { margin: 0; font-size: clamp(28px, 4vw, 36px); letter-spacing: -.035em; }
      .intro { margin: 0 0 20px; color: var(--md-sys-color-on-surface-variant, #ccc); }
      .card {
        display: grid;
        gap: 16px;
        padding: clamp(18px, 3vw, 26px); border-radius: 22px;
        border: 1px solid var(--lfc-glass-border, #51474e);
        background: var(--lfc-glass-surface, #242126);
        backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      }
      label { display: grid; gap: 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #ccc); }
      input:focus-visible { outline: 2px solid var(--md-sys-color-primary, #3477d2); outline-offset: 2px; }

      flex-column {
        gap: 12px;
      }

      .qr-container {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background: var(--md-sys-color-surface-container-high);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 16px;
        box-sizing: border-box;
      }

      .qr {
        width: 100%;
        max-width: 280px;
        aspect-ratio: 1 / 1;
        object-fit: contain;
      }

      .qr-empty {
        display: grid;
        justify-items: center;
        gap: 12px;
        max-width: 280px;
        padding: 20px;
        text-align: center;
      }

      .qr-empty svg {
        width: 112px;
        height: 112px;
        color: var(--md-sys-color-primary, #3477d2);
      }

      .qr-empty strong {
        font-size: 15px;
      }

      .qr-empty span {
        color: var(--md-sys-color-on-surface-variant, #ccc);
        font-size: 13px;
        line-height: 1.5;
      }

      .address {
        width: 100%;
        box-sizing: border-box;
        word-break: break-all;
        font-size: 12px;
        color: var(--md-sys-color-on-surface-variant);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 10px 12px;
        background: var(--md-sys-color-surface-container-high);
      }

      flex-row {
        width: 100%;
        gap: 8px;
        flex-wrap: wrap;
      }

      input {
        box-sizing: border-box;
        width: 100%;
        pointer-events: auto;
        background: var(--md-sys-color-surface-container-highest);
        border: 1px solid var(--border-color);
        font-size: 16px;
        color: var(--md-sys-color-on-surface-container-highest);
        border-radius: 12px;
        padding: 10px 12px;
      }

      .hint {
        color: var(--md-sys-color-on-surface-variant);
        font-size: 12px;
      }

      button {
        min-height: 44px;
        padding: 10px 14px;
        border: 1px solid var(--lfc-glass-border, #51474e);
        border-radius: 12px;
        color: var(--md-sys-color-on-surface, #eee);
        background: rgb(255 255 255 / 4%);
        font: inherit;
        cursor: pointer;
      }
      button:hover:not(:disabled) { background: var(--md-sys-color-surface-container-high); }
      button:disabled { opacity: .45; cursor: default; }
      button:focus-visible { outline: 2px solid var(--md-sys-color-primary, #3477d2); outline-offset: 2px; }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .actions button { flex: 1 1 140px; }
      .message {
        color: var(--md-sys-color-primary, #3477d2);
        font-size: 13px;
      }
      .error {
        color: var(--md-sys-color-error, #ffb4ab);
        font-size: 13px;
      }
    `
  ]

  async #copyAddress() {
    if (!this.address) return
    try {
      await navigator.clipboard.writeText(this.address)
      this.message = 'Address copied'
    } catch {
      this.message = 'Could not copy the address. Select and copy it manually.'
    }
  }

  async #copyRequest() {
    if (!this.requestUrl) return
    try {
      await navigator.clipboard.writeText(this.requestUrl)
      this.message = 'Payment request copied'
    } catch {
      this.message = 'Could not copy the request. Try sharing it instead.'
    }
  }

  async #shareRequest() {
    if (!this.requestUrl || !this.shareSupported) return
    try {
      await navigator.share({
        title: 'Payment Request',
        text: this.requestText,
        url: this.requestUrl
      })
      this.message = 'Payment request shared'
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') this.message = 'Could not share the payment request.'
    }
  }

  render() {
    return html`
      <main>
        <h1>Receive</h1>
        <p class="intro">Share your address or create a payment request.</p>
        <flex-column class="card">
          <div class="qr-container">
            ${this.qrCodeDataUrl
              ? html`<img class="qr" src=${this.qrCodeDataUrl} alt="Payment QR code" />`
              : html`<div class="qr-empty" role="status">
                  <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
                    <rect x="19" y="24" width="82" height="72" rx="18" stroke="currentColor" stroke-width="3"/>
                    <path d="M34 44h52M34 57h31" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/>
                    <circle cx="79" cy="75" r="15" fill="var(--md-sys-color-surface-container-high, #29262a)" stroke="currentColor" stroke-width="3"/>
                    <path d="M79 66v18M73 70h9a4 4 0 0 1 0 8h-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                  </svg>
                  <strong>Unlock your wallet to receive</strong>
                  <span>Your address and payment QR will appear here when the wallet is ready.</span>
                </div>`}
          </div>
          ${this.qrError ? html`<p class="error" role="alert">${this.qrError}</p>` : ''}

          <div class="address">${this.address || 'No address available yet'}</div>

          <label>Amount <span class="hint">Optional · LFC</span><input
            class="amount"
            inputmode="decimal"
            placeholder="Amount (optional)"
            .value=${this.amount}
            @input=${(event: Event) => {
              this.amount = (event.target as HTMLInputElement).value
            }} /></label>

          <label>Note <span class="hint">Optional</span><input
            class="note"
            placeholder="Note (optional)"
            .value=${this.note}
            @input=${(event: Event) => {
              this.note = (event.target as HTMLInputElement).value
            }} /></label>

          <span class="hint">Share this QR or link to request a payment.</span>

          <div class="actions">
            <button ?disabled=${!this.address} @click=${this.#copyAddress}>Copy address</button>
            <button ?disabled=${!this.requestUrl} @click=${this.#copyRequest}>Copy request</button>
          </div>

          <div class="actions">
            <button ?disabled=${!this.shareSupported || !this.requestUrl} @click=${this.#shareRequest}
              >Share request</button
            >
            ${NFC_SUPPORT
              ? html`<button aria-label="Share request using NFC" ?disabled=${!this.address} @click=${() => write({ amount: this.amount, to: this.address })}
                  >Share with NFC</button>`
              : ''}
          </div>
          ${this.message ? html`<p class="message" role="status">${this.message}</p>` : ''}
        </flex-column>
      </main>
    `
  }
}

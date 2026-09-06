import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-tonal-button.js'
import './../../elements/hero.js'
import * as qrcode from 'qrcode'
import { write, NFC_SUPPORT } from './../../integrations/nfc.js'

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

  protected willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('wallet')) {
      this.#syncAddressFromWallet()
    }

    if (changedProperties.has('amount') || changedProperties.has('note') || changedProperties.has('address')) {
      this.#buildRequest()
    }
  }

  async #buildRequest() {
    if (!this.address) {
      this.requestUrl = ''
      this.requestText = ''
      this.qrCodeDataUrl = ''
      return
    }

    const params = new URLSearchParams({
      to: this.address,
      protocol: 'url'
    })

    if (this.amount) params.set('amount', this.amount)
    if (this.note) params.set('description', this.note)

    this.requestUrl = `#!/wallet/pay?${params.toString()}`
    this.requestText = JSON.stringify(
      {
        action: 'pay',
        to: this.address,
        amount: this.amount || undefined,
        description: this.note || undefined,
        protocol: 'json'
      },
      null,
      2
    )

    this.qrCodeDataUrl = await qrcode.toDataURL(this.requestUrl)
  }

  #syncAddressFromWallet() {
    if (this.wallet?.selectedAccount) {
      this.address = this.wallet.selectedAccount
      return
    }

    if (
      typeof this.wallet?.selectedAccountIndex === 'number' &&
      this.wallet.accounts?.[this.wallet.selectedAccountIndex]
    ) {
      this.address = this.wallet.accounts[this.wallet.selectedAccountIndex][1]
    }
  }

  static styles = [
    css`
      :host {
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
        display: flex;
        flex-direction: column;
      }

      hero-element {
        max-height: none;
        max-width: 420px;
        width: 100%;
      }

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
      }

      input {
        box-sizing: border-box;
        width: 100%;
        pointer-events: auto;
        background: var(--md-sys-color-surface-container-highest);
        border: 1px solid var(--border-color);
        font-size: 14px;
        color: var(--md-sys-color-on-surface-container-highest);
        border-radius: 12px;
        padding: 10px 12px;
      }

      .hint {
        color: var(--md-sys-color-on-surface-variant);
        font-size: 12px;
      }

      md-icon-button,
      md-filled-tonal-button,
      md-outlined-button {
        cursor: pointer;
        pointer-events: auto;
      }
    `
  ]

  async #copyAddress() {
    if (!this.address) return
    await navigator.clipboard.writeText(this.address)
  }

  async #copyRequest() {
    if (!this.requestUrl) return
    await navigator.clipboard.writeText(this.requestUrl)
  }

  async #shareRequest() {
    if (!this.requestUrl || !this.shareSupported) return
    await navigator.share({
      title: 'Payment Request',
      text: this.requestText,
      url: this.requestUrl
    })
  }

  render() {
    return html`
      <hero-element headline="Receive">
        <flex-column>
          <div class="qr-container">
            ${this.qrCodeDataUrl
              ? html`<img class="qr" src=${this.qrCodeDataUrl} alt="Payment QR code" />`
              : html`<custom-typography type="body">Waiting for wallet address...</custom-typography>`}
          </div>

          <div class="address">${this.address || 'No address available yet'}</div>

          <input
            class="amount"
            placeholder="Amount (optional)"
            .value=${this.amount}
            @input=${(event: Event) => {
              this.amount = (event.target as HTMLInputElement).value
            }} />

          <input
            class="note"
            placeholder="Note (optional)"
            .value=${this.note}
            @input=${(event: Event) => {
              this.note = (event.target as HTMLInputElement).value
            }} />

          <span class="hint">Share this QR or link to request a payment.</span>

          <flex-row>
            <md-outlined-button @click=${this.#copyAddress}>Copy address</md-outlined-button>
            <md-outlined-button @click=${this.#copyRequest}>Copy request</md-outlined-button>
          </flex-row>

          <flex-row>
            <md-filled-tonal-button ?disabled=${!this.shareSupported || !this.requestUrl} @click=${this.#shareRequest}
              >Share request</md-filled-tonal-button
            >
            ${NFC_SUPPORT
              ? html`<md-icon-button @click=${() => write({ amount: this.amount, to: this.address })}
                  ><custom-icon icon="share"></custom-icon
                ></md-icon-button>`
              : ''}
          </flex-row>
        </flex-column>
      </hero-element>
    `
  }
}

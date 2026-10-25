import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { readActivity } from '../../controllers/activity.js'

@customElement('wallet-transactions')
export class WalletTransactions extends LitElement {
  @property({ type: Object }) accessor wallet: any
  @state() accessor entries = []
  #refresh = () => {
    this.entries = readActivity(this.wallet?.selectedAccount)
  }
  connectedCallback() {
    super.connectedCallback()
    window.addEventListener('wallet-activity-changed', this.#refresh)
    this.#refresh()
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('wallet-activity-changed', this.#refresh)
  }
  updated(changed) {
    if (changed.has('wallet')) this.#refresh()
  }
  static styles = css`
    :host {
      display: block;
      padding: 24px 16px;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: auto;
      color: var(--md-sys-color-on-surface, #eee);
    }
    main {
      max-width: var(--lfc-page-width, 720px);
      margin: auto;
    }
    article {
      border: 1px solid var(--lfc-glass-border, #51474e);
      background: var(--lfc-glass-surface, #242126);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border-radius: 22px;
      padding: clamp(18px, 3vw, 26px);
      margin: 16px 0;
      overflow-wrap: anywhere;
    }
    small {
      opacity: 0.75;
    }
    strong {
      display: block;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
    }
    h1 { margin: 0; font-size: clamp(28px, 4vw, 36px); letter-spacing: -.035em; }
    .empty { text-align: center; padding: 40px 24px; }
    .empty svg { display: block; width: 124px; height: 96px; margin: 0 auto 20px; color: var(--md-sys-color-primary, #f4a77f); }
    .empty strong { font-size: 16px; }
    .empty p { max-width: 340px; margin: 8px auto 0; color: var(--md-sys-color-on-surface-variant, #ccc); }
  `
  render() {
    return html`<main>
      <h1>Activity</h1>
      <p>
        Transfers sent from this browser. Pending entries are not proof of confirmation; keep the node open while
        waiting.
      </p>
      ${this.entries.length
        ? this.entries.map(
            (entry) =>
              html`<article>
                <strong
                  >${entry.amount} LFC ·
                  ${entry.phase === 'confirmed' ? 'Confirmed' : entry.phase === 'failed' ? 'Failed' : 'Pending'}</strong
                >
                <p>To ${entry.to}</p>
                <small>Fee: ${entry.fee} LFC</small>
                <p>${entry.hash}</p>
                <small>${new Date(entry.timestamp).toLocaleString()}</small>
              </article>`
          )
        : html`<article class="empty">
            <svg viewBox="0 0 128 96" fill="none" aria-hidden="true">
              <rect x="15" y="20" width="70" height="58" rx="12" stroke="currentColor" stroke-width="3" opacity=".45"/>
              <rect x="28" y="12" width="70" height="58" rx="12" fill="var(--lfc-glass-surface, #242126)" stroke="currentColor" stroke-width="3"/>
              <path d="M43 30h40M43 41h26" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/>
              <circle cx="84" cy="67" r="21" fill="var(--lfc-glass-surface, #242126)" stroke="currentColor" stroke-width="3"/>
              <path d="M84 56v12l8 5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <strong>No activity yet</strong>
            <p>Once you send a transfer, its status and confirmation details will show up here.</p>
          </article>`}
    </main>`
  }
}

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
      padding: 24px;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: auto;
      color: var(--font-color, #eee);
    }
    main {
      max-width: 680px;
      margin: auto;
    }
    article {
      border: 1px solid var(--border-color, #45505d);
      border-radius: 16px;
      padding: 16px;
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
    }
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
        : html`<p>No transfers sent from this browser yet.</p>`}
    </main>`
  }
}

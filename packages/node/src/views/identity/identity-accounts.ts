import { LitElement, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { viewHeader, viewIllustration, viewPolish, type IdentityAccount } from '../view-polish.js'
import { errorMessage } from '../../controllers/transfer.js'

@customElement('identity-accounts')
export class IdentityAccounts extends LitElement {
  @property({ type: Array }) accessor accounts: IdentityAccount[] = []
  @property({ type: Boolean }) accessor expanded = false
  @state() accessor message = ''
  @state() accessor error = ''

  static styles = viewPolish

  async #copy(address: string) {
    this.error = ''
    this.message = ''
    try {
      await navigator.clipboard.writeText(address)
      this.message = 'Address copied.'
    } catch (error) {
      this.error = `Could not copy address: ${errorMessage(error)}`
    }
  }

  #address(label: string, address: string, name: string) {
    return html`<div class="address-row"><div><span class="muted">${label}</span><code>${address}</code></div>
      <button class="secondary" aria-label=${`Copy ${label.toLowerCase()} for ${name}`} @click=${() => this.#copy(address)}>Copy address</button></div>`
  }

  render() {
    const accounts = this.accounts ?? []
    return html`<main>
      ${viewHeader('accounts', 'PUBLIC ADDRESSES', this.expanded ? 'Account details' : 'Your accounts', 'Each account has external and internal addresses. Expand an account to explore and copy its public addresses.')}
      <section class="card">
        <div class="section-title"><h2>Wallet accounts</h2><span class="badge">${accounts.length}</span></div>
        ${accounts.length ? accounts.map(([name, external, internal], index) => html`<details ?open=${this.expanded}>
          <summary><span class="row"><span class="avatar" aria-hidden="true">${index + 1}</span><span class="row-info"><strong>${name}</strong><span class="muted">External &amp; internal addresses</span></span><span class="chevron" aria-hidden="true">›</span></span></summary>
          <div class="detail-body">
            ${this.#address('External address', external, name)}
            ${this.#address('Internal address', internal, name)}
          </div>
        </details>`) : html`<div class="empty">${viewIllustration('accounts')}<h3>No accounts available</h3><p class="muted">Unlock your wallet to see its public addresses.</p></div>`}
        <p class="feedback" role="status">${this.message}</p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
      </section>
      <section class="card security-note"><h2>Public, not private</h2><p class="muted">These addresses can be shared. Your private keys and recovery information are never shown here.</p></section>
    </main>`
  }
}

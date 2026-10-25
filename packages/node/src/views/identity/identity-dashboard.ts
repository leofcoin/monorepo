import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { viewHeader, viewIllustration, viewPolish, type IdentityAccount } from '../view-polish.js'

@customElement('identity-dashboard')
export class IdentityDashboard extends LitElement {
  @property({ type: Array }) accessor accounts: IdentityAccount[] = []

  static styles = viewPolish

  render() {
    const accounts = this.accounts ?? []
    const addresses = new Set(accounts.flatMap(([, external, internal]) => [external, internal]).filter(Boolean))
    return html`<main>
      ${viewHeader('identity', 'YOUR WALLET IDENTITY', 'Make it yours', 'Your accounts and public addresses, together in one place. Keep your backup safe and your identity in your hands.')}
      <section class="metrics" aria-label="Identity overview">
        <article class="card metric">${viewIllustration('accounts')}<span class="muted">Wallet accounts</span><strong>${accounts.length}</strong></article>
        <article class="card metric">${viewIllustration('identity')}<span class="muted">Public addresses</span><strong>${addresses.size}</strong></article>
      </section>
      <section class="card">
        <div class="section-title"><span class="avatar" aria-hidden="true">ID</span><h2>Your accounts</h2><span class="badge">${accounts.length}</span></div>
        ${accounts.length ? html`<p class="muted">Explore your external and internal addresses, or copy them to share.</p>
          <div class="actions"><a class="button" href="#!/identity/accounts">Explore accounts <span aria-hidden="true">→</span></a></div>`
          : html`<div class="empty">${viewIllustration('accounts')}<h3>No accounts available</h3><p class="muted">Unlock your wallet to see your accounts.</p></div>`}
      </section>
      <section class="card security-note">
        <h2>A little backup goes a long way</h2>
        <p class="muted">Export a password-protected backup and store it somewhere private. Never share your backup or password.</p>
        <div class="actions"><a class="button secondary" href="#!/identity/actions">Backup &amp; security <span aria-hidden="true">→</span></a></div>
      </section>
    </main>`
  }
}

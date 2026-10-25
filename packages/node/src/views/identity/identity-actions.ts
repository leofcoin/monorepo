import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import * as qrcode from 'qrcode'
import { viewHeader, viewPolish } from '../view-polish.js'
import { errorMessage } from '../../controllers/transfer.js'

@customElement('identity-actions')
export class IdentityActions extends LitElement {
  @state() accessor exporting = false
  @state() accessor error = ''
  @state() accessor message = ''

  static styles = viewPolish

  async #export() {
    if (this.exporting) return
    this.exporting = true
    this.error = ''
    this.message = ''
    try {
      const shell = document.querySelector<HTMLElement & {
        requestWalletPassword(): Promise<string>
        showExport(qrcode: string, exported: string): void
      }>('app-shell')
      if (!shell) throw new Error('Application shell is unavailable.')
      const password = await shell.requestWalletPassword()
      const controller = (globalThis as typeof globalThis & { identityController: { export(password: string): Promise<string> } }).identityController
      const exported = await controller.export(password)
      const qr = await qrcode.toDataURL(exported)
      shell.showExport(qr, exported)
      this.message = 'Backup ready. Store it securely before closing the export screen.'
    } catch (error) {
      this.error = errorMessage(error)
    } finally {
      this.exporting = false
    }
  }

  render() {
    return html`<main>
      ${viewHeader('backup', 'BACKUP & SECURITY', 'Keep your identity safe', 'Your wallet, your responsibility. Create an encrypted backup so you can recover your accounts when you need them.')}
      <section class="card">
        <div class="section-title"><span class="avatar" aria-hidden="true">↓</span><h2>Encrypted wallet backup</h2><span class="badge">Password protected</span></div>
        <p class="muted">Choose a password to encrypt your backup, then save it from the export screen. Keep both the backup and its password safe.</p>
        <div class="actions"><button @click=${this.#export} ?disabled=${this.exporting} aria-busy=${this.exporting}>
          ${this.exporting ? 'Preparing backup...' : 'Export encrypted backup'}<span aria-hidden="true">↗</span>
        </button></div>
        <p class="feedback" role="status">${this.message}</p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
      </section>
      <section class="card security-note">
        <h2>Before you back up</h2>
        <p class="muted">Store a copy offline, away from your everyday device. Anyone with the backup and password can access your wallet.</p>
        <details><summary class="row"><span class="row-info">A few good habits</span><span class="chevron" aria-hidden="true">›</span></summary>
          <div class="detail-body muted"><p>Use a unique password and keep it separate from the backup.</p><p>Never paste backup contents into chat or send them to someone offering support.</p><p>Check that your saved backup is readable before relying on it.</p></div>
        </details>
      </section>
    </main>`
  }
}

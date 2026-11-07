import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { addContact, addressBookStorageKey, findContact } from '../controllers/address-book.js'
import { errorMessage } from '../controllers/transfer.js'
import { getSelectedNetwork } from '../network-selection.js'

@customElement('payment-recipient')
export class PaymentRecipient extends LitElement {
  @property() accessor address = ''
  @property() accessor network = getSelectedNetwork().network
  @property({ type: Boolean }) accessor disabled = false
  @state() accessor contact: { name: string; address: string } | null = null
  @state() accessor contactName = ''
  @state() accessor error = ''
  @state() accessor saveError = ''
  @state() accessor saving = false
  #target?: { address: string; network: string }
  #contactNetwork = ''

  connectedCallback() {
    super.connectedCallback()
    this.#refresh()
    window.addEventListener('storage', this.#storageChanged)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('storage', this.#storageChanged)
    this.shadowRoot?.querySelector('dialog')?.close()
    this.#target = undefined
  }
  updated(changed) {
    if (changed.has('address') || changed.has('network')) {
      this.shadowRoot?.querySelector('dialog')?.close()
      this.#target = undefined
      this.#refresh()
    }
  }
  #refresh = () => {
    this.#contactNetwork = this.network
    try { this.contact = findContact(this.address, globalThis.localStorage, this.network); this.error = '' }
    catch (error) { this.contact = null; this.error = errorMessage(error) }
  }
  #storageChanged = (event: StorageEvent) => {
    if (event.key === null || event.key === addressBookStorageKey(this.network)) this.#refresh()
  }
  #open = async () => {
    if (this.disabled || this.saving || this.error || !this.address) return
    this.#target = { address: this.address, network: this.network }
    this.contactName = ''; this.saveError = ''
    await this.updateComplete
    if (!this.isConnected || !this.#target) return
    const dialog = this.shadowRoot.querySelector('dialog')
    if (!dialog.open) dialog.showModal()
    dialog.querySelector('input')?.focus()
  }
  #close = () => {
    if (this.saving) return
    this.shadowRoot.querySelector('dialog')?.close()
    this.#target = undefined
    this.saveError = ''
  }
  #save = async (event: SubmitEvent) => {
    event.preventDefault()
    const target = this.#target
    if (!target || this.saving || this.disabled) return
    this.saving = true; this.saveError = ''
    try {
      // Capture the explicit destination/network before asynchronous validation.
      await addContact(this.contactName, target.address, globalThis.localStorage, target.network)
      if (this.#target === target && this.isConnected) {
        this.shadowRoot.querySelector('dialog')?.close()
        this.#target = undefined
        this.#refresh()
      }
    } catch (error) { if (this.#target === target) this.saveError = errorMessage(error) }
    finally { this.saving = false }
  }

  static styles = css`
    :host { display:block; min-width:0; color:var(--md-sys-color-on-surface,#f0edf0); }
    * { box-sizing:border-box; } .recipient { display:grid; grid-template-columns:42px minmax(0,1fr); gap:12px; align-items:start; }
    .avatar { width:42px; height:42px; display:grid; place-items:center; border-radius:14px; font-size:20px;
      background:var(--md-sys-color-primary-container,#34365b); color:var(--md-sys-color-on-primary-container,#e2e1ff); }
    .label { display:block; font-size:11px; color:var(--md-sys-color-on-surface-variant,#bbb6c3); margin:2px 0 6px; }
    strong { display:block; font-size:17px; line-height:1.4; overflow-wrap:anywhere; margin-bottom:6px; }
    .address { display:block; font:12px/1.65 ui-monospace,monospace; overflow-wrap:anywhere; user-select:all; color:var(--md-sys-color-on-surface-variant,#c0bbc6); }
    summary { cursor:pointer; font-size:12px; padding:5px 0; color:var(--md-sys-color-on-surface-variant,#c0bbc6); }
    .add-contact { border:0; background:none; color:var(--md-sys-color-primary,#9fc4ff); padding:6px 0; margin-top:4px; min-height:44px; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
    button { font:inherit; cursor:pointer; min-height:44px; border:1px solid var(--md-sys-color-outline-variant,#55505e); border-radius:12px; padding:10px 16px; background:transparent; color:inherit; }
    button:disabled { opacity:.45; cursor:not-allowed; } button.primary { background:var(--md-sys-color-primary,#9fc4ff); color:var(--md-sys-color-on-primary,#132d4b); border-color:transparent; }
    dialog { width:min(440px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto; margin:auto; padding:24px; color:inherit;
      border:1px solid var(--md-sys-color-outline-variant,#55505e); border-radius:20px; background:var(--md-sys-color-surface-container,#222127); }
    dialog::backdrop { background:rgb(0 0 0 / 60%); } h2 { margin:0; font-size:21px; } p { margin:10px 0 20px; }
    form { display:grid; gap:18px; } label { display:grid; gap:8px; font-size:13px; }
    input { width:100%; min-height:44px; border-radius:10px; border:1px solid var(--md-sys-color-outline-variant,#55505e); padding:12px; font:inherit; color:inherit; background:var(--md-sys-color-surface,#19181d); }
    .actions { display:flex; justify-content:flex-end; gap:10px; } .error { font-size:12px; line-height:1.6; color:var(--md-sys-color-error,#ffb4ab); margin:8px 0; }
    :is(button,input,summary):focus-visible { outline:2px solid var(--md-sys-color-primary,#9fc4ff); outline-offset:3px; }
    @media(max-width:480px) { .recipient { grid-template-columns:36px minmax(0,1fr); } .avatar { width:36px; height:36px; } }
  `
  render() {
    const contact = this.#contactNetwork === this.network && this.contact?.address === this.address ? this.contact : null
    return html`<div class="recipient">
      <span class="avatar" aria-hidden="true">${contact ? Array.from(contact.name)[0]?.toUpperCase() : '↗'}</span>
      <div><span class="label">To recipient</span>
        ${contact ? html`<strong class="contact-name">${contact.name}</strong>
          <details><summary>View wallet address</summary><span class="address">${this.address}</span></details>`
          : html`<span class="address">${this.address}</span>
            <button class="add-contact" ?disabled=${this.disabled || Boolean(this.error)} @click=${this.#open}>+ Add to address book</button>`}
        ${this.error ? html`<p class="error" role="alert">Address book unavailable: ${this.error}</p>` : ''}
      </div>
    </div>
    <dialog aria-labelledby="save-contact-title" @cancel=${(event: Event) => { event.preventDefault(); this.#close() }}>
      <h2 id="save-contact-title">Save recipient</h2><p class="address">${this.#target?.address || this.address}</p>
      <form @submit=${this.#save}>
        <label>Contact name<input aria-label="Contact name" required maxlength="40" autocomplete="off" .value=${this.contactName}
          ?disabled=${this.saving} @input=${event => this.contactName = event.target.value}></label>
        ${this.saveError ? html`<p class="error" role="alert">${this.saveError}</p>` : ''}
        <div class="actions"><button type="button" ?disabled=${this.saving} @click=${this.#close}>Cancel</button>
          <button type="submit" class="primary" ?disabled=${this.saving || !this.contactName.trim()}>${this.saving ? 'Saving…' : 'Save contact'}</button></div>
      </form>
    </dialog>`
  }
}

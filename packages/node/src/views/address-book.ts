import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { addContact, listContacts, removeContact, renameContact } from '../controllers/address-book.js'
import { errorMessage } from '../controllers/transfer.js'
import { getSelectedNetwork } from '../network-selection.js'

interface Contact {
  name: string
  address: string
}

@customElement('address-book-view')
export class AddressBookView extends LitElement {
  @property({ type: Object }) accessor wallet: { selectedAccount?: string } | undefined
  @state() accessor contacts: Contact[] = []
  @state() accessor contactName = ''
  @state() accessor contactAddress = ''
  @state() accessor editingAddress = ''
  @state() accessor editingName = ''
  @state() accessor error = ''
  @state() accessor saving = false
  @state() accessor message = ''

  connectedCallback() {
    super.connectedCallback()
    try {
      this.contacts = listContacts()
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #add = async (event: SubmitEvent) => {
    event.preventDefault()
    if (this.saving) return
    this.saving = true
    this.message = ''
    try {
      this.contacts = await addContact(this.contactName, this.contactAddress)
      this.contactName = ''
      this.contactAddress = ''
      this.error = ''
      this.message = 'Contact added.'
    } catch (error) {
      this.error = errorMessage(error)
    } finally {
      this.saving = false
    }
  }

  #rename = (event: SubmitEvent) => {
    event.preventDefault()
    this.message = ''
    try {
      this.contacts = renameContact(this.editingAddress, this.editingName)
      this.editingAddress = ''
      this.error = ''
      this.message = 'Contact renamed.'
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #remove = (contact: Contact) => {
    if (!window.confirm(`Remove ${contact.name} from your address book?`)) return
    this.message = ''
    try {
      this.contacts = removeContact(contact.address)
      this.error = ''
      this.message = 'Contact removed.'
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      overflow: auto;
      padding: clamp(14px, 2vw, 24px) 16px 28px;
      color: var(--md-sys-color-on-surface, #eee);
    }
    main { max-width: 760px; margin: auto; display: grid; gap: 20px; }
    .hero {
      position: relative;
      overflow: hidden;
      padding: 28px;
      padding-right: 140px;
      border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 24px;
      background: radial-gradient(ellipse at top right, color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 18%, transparent), transparent 75%);
    }
    .hero-art { position: absolute; right: 16px; top: 22px; width: 110px; height: 110px; color: var(--md-sys-color-primary, #8dbbff); }
    .hero-art .spark { transform-box: fill-box; transform-origin: center; animation: sparkle 3s ease-in-out 2; }
    .hero-art .spark:last-child { animation-delay: .5s; }
    .section-title { display: flex; align-items: center; gap: 10px; }
    .section-title svg { width: 22px; height: 22px; flex-shrink: 0; color: var(--md-sys-color-primary, #8dbbff); }
    .count { display: inline-grid; place-items: center; min-width: 26px; height: 26px; border-radius: 9px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 12%, transparent); }
    .avatar { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border-radius: 15px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 16%, transparent); color: var(--md-sys-color-primary, #8dbbff); font-size: 18px; font-weight: 700; }
    .contact:nth-of-type(3n + 2) .avatar { background: color-mix(in srgb, var(--md-sys-color-tertiary, #dfb8fa) 16%, transparent); color: var(--md-sys-color-tertiary, #dfb8fa); }
    .empty { display: grid; justify-items: center; gap: 12px; padding: 28px 16px; text-align: center; }
    .empty svg { width: 64px; height: 64px; color: var(--md-sys-color-primary, #8dbbff); }
    h1, h2, p { margin: 0; }
    h1 { font-size: 32px; letter-spacing: -.035em; }
    h2 { font-size: 19px; }
    header, section, form, .contact-info { display: grid; gap: 12px; min-width: 0; }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--md-sys-color-primary, #8dbbff); }
    .muted, .contact-address { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 13px; }
    .card {
      padding: 22px;
      border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 20px;
      background: var(--lfc-glass-surface, #242126);
      animation: arrive 320ms ease-out both;
    }
    .card:nth-of-type(2) { animation-delay: 60ms; }
    label { display: grid; gap: 8px; font-size: 13px; }
    input, button { font: inherit; box-sizing: border-box; border-radius: 12px; min-height: 44px; padding: 10px 14px; }
    input {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--lfc-glass-border, #51474e);
      color: inherit;
      background: var(--md-sys-color-surface-container, #171619);
      font-size: 16px;
    }
    button { cursor: pointer; border: 1px solid transparent; background: var(--lfc-action, #1d64d8); color: var(--lfc-on-action, #fff); font-weight: 600; }
    button.secondary { background: transparent; border-color: var(--lfc-glass-border, #51474e); color: inherit; }
    button:disabled { opacity: .5; cursor: default; }
    button:focus-visible, input:focus-visible { outline: 2px solid var(--md-sys-color-primary, #8dbbff); outline-offset: 2px; }
    .contact { display: flex; align-items: center; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
    .contact { animation: arrive 220ms ease-out both; }
    button { transition: background 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
    button:hover:not(:disabled) { box-shadow: 0 4px 16px rgb(0 0 0 / 12%); transform: translateY(-1px); }
    button.secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 9%, transparent); }
    button:active:not(:disabled) { transform: translateY(0); }
    @keyframes arrive { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes sparkle { 0%, 100% { transform: scale(.85); opacity: .5; } 50% { transform: scale(1.1); opacity: 1; } }
    .contact:last-child { border-bottom: 0; }
    .contact-info { flex: 1; gap: 4px; }
    .contact-address { overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .contact form { width: 100%; }
    .error { color: var(--md-sys-color-error, #ffb4ab); overflow-wrap: anywhere; }
    @media (max-width: 540px) {
      .card { padding: 16px; }
      .contact { align-items: stretch; flex-direction: column; }
      .hero { padding: 22px; padding-right: 90px; }
      .hero-art { width: 70px; height: 70px; right: 10px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card, .contact, .hero-art .spark { animation: none; }
      button { transition: none; }
      button:hover:not(:disabled) { transform: none; }
    }
  `

  render() {
    return html`<main>
      <header class="hero">
        <svg class="hero-art" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="48" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="3 7"/>
          <rect x="30" y="23" width="57" height="75" rx="12" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/>
          <path d="M24 40h13m-13 20h13m-13 20h13M46 80c1-10 7-15 15-15s14 5 15 15" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <circle cx="61" cy="49" r="9" stroke="currentColor" stroke-width="3"/>
          <path class="spark" d="m97 17 2.5 7.5L107 27l-7.5 2.5L97 37l-2.5-7.5L87 27l7.5-2.5Z" fill="currentColor"/>
          <path class="spark" d="m96 83 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor"/>
        </svg>
        <span class="eyebrow">${getSelectedNetwork().label}</span>
        <h1>Address book</h1>
        <p class="muted">Save your own addresses and trusted recipients, such as Alice, on this device.</p>
      </header>
      <section class="card" aria-labelledby="add-heading">
        <div class="section-title">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m4-13v8m-4-4h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          <h2 id="add-heading">Add contact</h2>
        </div>
        <form @submit=${this.#add}>
          <label>Contact name
            <input aria-label="Contact name" maxlength="40" placeholder="Alice" required
              .value=${this.contactName} ?disabled=${this.saving}
              @input=${(event: InputEvent) => (this.contactName = (event.target as HTMLInputElement).value)} />
          </label>
          <label>Wallet address
            <input aria-label="Contact wallet address" autocomplete="off" spellcheck="false" required
              placeholder="Leofcoin address" .value=${this.contactAddress} ?disabled=${this.saving}
              @input=${(event: InputEvent) => (this.contactAddress = (event.target as HTMLInputElement).value)} />
          </label>
          <div class="actions">
            <button type="submit" ?disabled=${this.saving}>${this.saving ? 'Saving...' : 'Add contact'}</button>
            ${this.wallet?.selectedAccount
              ? html`<button type="button" class="secondary" ?disabled=${this.saving}
                  @click=${() => (this.contactAddress = this.wallet.selectedAccount)}>Use my address</button>`
              : ''}
          </div>
        </form>
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : ''}
        <p role="status" class="muted">${this.message}</p>
      </section>
      <section class="card" aria-labelledby="contacts-heading">
        <div class="section-title">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="3" width="15" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 7h4m-4 5h4m-4 5h4m4-9h5m-5 4h5m-5 4h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          <h2 id="contacts-heading">Saved contacts</h2><span class="count muted">${this.contacts.length}</span>
        </div>
        ${!this.contacts.length ? html`<div class="empty">
          <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="11" y="10" width="42" height="45" rx="10" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.5"/><circle cx="32" cy="27" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 45c1-7 5-10 12-10s11 3 12 10M49 6v10m-5-5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <strong>Your people, one tap away</strong>
          <p class="muted">No saved contacts yet. Add a name and address above.</p>
        </div>` : ''}
        ${this.contacts.map((contact) => html`<article class="contact">
          ${this.editingAddress === contact.address
            ? html`<form @submit=${this.#rename}>
                <label>Contact name
                  <input aria-label="Rename contact" maxlength="40" required .value=${this.editingName}
                    @input=${(event: InputEvent) => (this.editingName = (event.target as HTMLInputElement).value)} />
                </label>
                <span class="contact-address">${contact.address}</span>
                <div class="actions">
                  <button type="submit">Save</button>
                  <button type="button" class="secondary" @click=${() => (this.editingAddress = '')}>Cancel</button>
                </div>
              </form>`
            : html`<span class="avatar" aria-hidden="true">${Array.from(contact.name)[0]?.toUpperCase()}</span>
                <div class="contact-info"><strong>${contact.name}</strong><span class="contact-address">${contact.address}</span></div>
                <div class="actions">
                  <button class="secondary" aria-label=${`Rename ${contact.name}`}
                    @click=${() => { this.editingAddress = contact.address; this.editingName = contact.name }}>Rename</button>
                  <button class="secondary" aria-label=${`Remove ${contact.name}`} @click=${() => this.#remove(contact)}>Remove</button>
                </div>`}
        </article>`)}
      </section>
    </main>`
  }
}

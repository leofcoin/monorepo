import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { formatUnits } from '@leofcoin/utils'
import { prepareTransfer, submitTransfer, networkStatus, errorMessage } from '../../controllers/transfer.js'
import { listContacts } from '../../controllers/address-book.js'
import { saveActivity } from '../../controllers/activity.js'
import { getSelectedNetwork } from '../../network-selection.js'

@customElement('wallet-send')
export class WalletSend extends LitElement {
  @property({ type: Object }) accessor wallet: any
  @property() accessor amount = ''
  @property() accessor to = ''
  @state() accessor balance = '—'
  @state() accessor status = { ready: false, label: 'Unlock your wallet to start the node.', peers: 0 }
  @state() accessor phase = 'entry'
  @state() accessor error = ''
  @state() accessor hash = ''
  @state() accessor prepared: any
  @state() accessor copyStatus = ''
  @state() accessor contacts: { name: string; address: string }[] = []
  @state() accessor contactError = ''
  @state() accessor contactSearch = ''
  #timer: ReturnType<typeof setInterval>
  #refreshing = false
  get busy() {
    return ['preparing', 'submitting', 'pending'].includes(this.phase)
  }
  connectedCallback() {
    super.connectedCallback()
    this.#refresh()
    this.#timer = setInterval(() => this.#refresh(), 3000)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    this.shadowRoot?.querySelector('dialog')?.close()
    clearInterval(this.#timer)
  }
  updated(changed) {
    if (changed.has('wallet')) this.#refresh()
  }
  async #refresh() {
    if (this.#refreshing) return
    this.#refreshing = true
    try {
      this.status = networkStatus(globalThis.chain, globalThis.peernet)
      const from = this.wallet?.selectedAccount
      this.balance = from && globalThis.chain ? formatUnits(BigInt((await chain.balanceOf(from)) ?? 0n)) : '—'
    } catch {
      this.balance = 'Unavailable'
    } finally {
      this.#refreshing = false
    }
  }
  #reset = () => {
    if (this.busy) return
    this.phase = 'entry'
    this.prepared = undefined
    this.error = ''
    this.hash = ''
  }
  #copyAddress = async () => {
    const address = this.wallet?.selectedAccount
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      this.copyStatus = 'Address copied'
      setTimeout(() => (this.copyStatus = ''), 2000)
    } catch {
      this.copyStatus = 'Could not copy the address. Select and copy it manually.'
    }
  }
  #openContacts = () => {
    if (this.busy) return
    this.contactSearch = ''
    try {
      this.contacts = listContacts()
      this.contactError = ''
    } catch (error) {
      this.contacts = []
      this.contactError = errorMessage(error)
    }
    this.shadowRoot.querySelector('dialog').showModal()
  }
  #selectContact = (contact) => {
    if (this.busy) return
    this.to = contact.address
    this.prepared = undefined
    this.phase = 'entry'
    this.error = ''
    this.shadowRoot.querySelector('dialog').close()
    this.updateComplete.then(() => this.shadowRoot.querySelector<HTMLInputElement>('[aria-label="Recipient address"]')?.focus())
  }
  #review = async () => {
    if (this.busy) return
    this.phase = 'preparing'
    this.error = ''
    this.hash = ''
    try {
      this.prepared = await prepareTransfer({
        chain: globalThis.chain,
        peernet: globalThis.peernet,
        identity: globalThis.identityController,
        from: this.wallet?.selectedAccount,
        to: this.to,
        amount: this.amount
      })
      this.phase = 'review'
    } catch (error) {
      this.error = errorMessage(error)
      this.phase = 'entry'
    }
  }
  #send = async () => {
    if (this.phase !== 'review') return
    if (this.wallet?.selectedAccount !== this.prepared.from) {
      this.error = 'Your selected account changed. Review the transfer again.'
      this.phase = 'entry'
      return
    }
    if (!networkStatus(chain, globalThis.peernet).ready) {
      this.error = 'The node lost its connection. Wait for sync before sending.'
      return
    }
    this.phase = 'submitting'
    this.error = ''
    try {
      await submitTransfer(chain, this.prepared, (event) => {
        this.phase = event.phase
        this.hash = event.hash || this.hash
        if (event.hash)
          saveActivity({
            ...this.prepared,
            signed: undefined,
            hash: event.hash,
            phase: event.phase,
            timestamp: Date.now()
          })
      })
      this.amount = ''
      this.to = ''
      await this.#refresh()
    } catch (error) {
      this.error = errorMessage(error)
      this.phase = 'failed'
      if (this.hash)
        saveActivity({ ...this.prepared, signed: undefined, hash: this.hash, phase: 'failed', timestamp: Date.now() })
    }
  }
  static styles = css`
    :host {
      --wallet-accent: var(--md-sys-color-primary, #3477d2);
      --wallet-accent-soft: var(--md-sys-color-primary, #3477d2);
      --wallet-accent-contrast: var(--md-sys-color-on-primary, #fff);
      display: block;
      width: 100%;
      height: 100%;
      overflow: auto;
      color: var(--md-sys-color-on-surface, #eee);
      box-sizing: border-box;
      padding: clamp(14px, 2vw, 24px) 16px 28px;
      scrollbar-gutter: stable;
    }
    main {
      width: 100%;
      max-width: 660px;
      margin: auto;
      display: grid;
      gap: 16px;
      align-content: start;
    }
    p,
    h1,
    h2 {
      margin: 0;
    }
    .page-heading {
      display: grid;
      gap: 5px;
    }
    .eyebrow {
      color: var(--wallet-accent-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(26px, 3.5vw, 32px);
      letter-spacing: -0.035em;
    }
    .subtitle {
      max-width: 52ch;
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 13px;
    }
    .balance-card,
    .transfer-card,
    .status-card {
      border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 20px;
      padding: clamp(16px, 2.4vw, 22px);
      background: var(--lfc-glass-surface, #242126);
      box-shadow: 0 12px 30px rgb(0 0 0 / 12%);
      -webkit-backdrop-filter: blur(18px) saturate(1.25);
      backdrop-filter: blur(18px) saturate(1.25);
    }
    .wallet-overview {
      display: grid;
      gap: 10px;
    }
    .balance-card {
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background:
        radial-gradient(ellipse at 100% 0%, rgb(91 167 255 / 11%), transparent 52%),
        var(--lfc-glass-surface, #242126);
      border-color: rgb(91 167 255 / 34%);
    }
    .balance-card::before {
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--wallet-accent);
      content: '';
    }
    .balance-copy {
      display: grid;
      min-width: 0;
      gap: 4px;
    }
    .balance {
      font-size: clamp(28px, 4vw, 36px);
      line-height: 1.05;
      letter-spacing: -0.04em;
      overflow-wrap: anywhere;
    }
    .balance small {
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: .42em;
      letter-spacing: .02em;
    }
    .account-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      margin-top: 5px;
    }
    .account-row svg {
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
      color: var(--wallet-accent-soft);
    }
    .address {
      min-width: 0;
      overflow: hidden;
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-address {
      flex: 0 0 auto;
      width: auto;
      min-height: 36px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      background: rgb(255 255 255 / 5%);
      color: inherit;
    }
    .transfer-card {
      display: grid;
      gap: 18px;
      padding: clamp(20px, 3vw, 28px);
      border-color: color-mix(in srgb, var(--lfc-glass-border, #51474e) 76%, transparent);
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--md-sys-color-surface-container-high, #29262a) 48%, transparent), transparent 58%),
        var(--lfc-glass-surface, #242126);
    }
    .transfer-heading {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .transfer-icon {
      display: grid;
      flex: 0 0 42px;
      width: 42px;
      height: 42px;
      place-items: center;
      border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 14px;
      color: var(--wallet-accent-soft);
      background: var(--md-sys-color-surface-container-high, #302d2a);
    }
    .transfer-icon svg {
      width: 19px;
      height: 19px;
    }
    .transfer-heading h2 {
      font-size: 19px;
      letter-spacing: -.02em;
    }
    .transfer-heading p {
      margin-top: 2px;
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 13px;
    }
    label {
      display: grid;
      gap: 8px;
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 13px;
      font-weight: 600;
    }
    input,
    button {
      font: inherit;
      border-radius: 14px;
      min-height: 50px;
      padding: 12px 14px;
      border: 1px solid var(--border-color, #45505d);
      color: inherit;
      background: transparent;
      box-sizing: border-box;
      width: 100%;
    }
    input {
      color: var(--md-sys-color-on-surface, #eee);
      background: color-mix(in srgb, var(--md-sys-color-surface-container, #171619) 68%, transparent);
      font-size: 16px;
    }
    input:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--wallet-accent);
      outline-offset: 2px;
    }
    input::placeholder {
      color: var(--md-sys-color-on-surface-variant, #ccc);
      opacity: .65;
    }
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 1000px var(--md-sys-color-surface-container, #252321) inset;
      -webkit-text-fill-color: var(--md-sys-color-on-surface, #eee);
      transition: background-color 9999s ease-out;
    }
    .amount-field {
      position: relative;
    }
    .amount-field input {
      padding-right: 62px;
    }
    .amount-field span {
      position: absolute;
      top: 50%;
      right: 14px;
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 13px;
      transform: translateY(-50%);
    }
    button {
      cursor: pointer;
      background: var(--lfc-action, #1d64d8);
      color: var(--lfc-on-action, #ffffff);
      font-weight: 700;
    }
    button.secondary {
      background: transparent;
      color: inherit;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    button:hover:not(:disabled) { filter: brightness(1.08); }
    button:active:not(:disabled) { transform: translateY(1px); }
    .review-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 50px;
      margin-top: 2px;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .actions button {
      flex: 1;
    }
    .secondary {
      background: transparent;
      color: inherit;
    }
    .error {
      color: var(--md-sys-color-error, #ffb4ab);
      padding: 11px 13px;
      border: 1px solid color-mix(in srgb, var(--md-sys-color-error, #ffb4ab) 35%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, var(--md-sys-color-error, #ffb4ab) 8%, transparent);
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      padding: 14px;
      border: 1px solid rgb(255 255 255 / 9%);
      border-radius: 16px;
      background: rgb(0 0 0 / 12%);
    }
    dt { color: var(--md-sys-color-on-surface-variant, #ccc); }
    dd {
      margin: 0;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .status-card {
      display: grid;
      justify-items: start;
      gap: 14px;
    }
    .status-card p,
    .status-card h2 {
      margin: 0;
    }
    .dialog-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .recipient-field { position: relative; }
    .recipient-field input { padding-right: 60px; }
    .recipient-picker {
      position: absolute;
      top: 50%;
      right: 4px;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      min-height: 44px;
      padding: 10px;
      border: 0;
      border-radius: 10px;
      transform: translateY(-50%);
    }
    .recipient-picker:active:not(:disabled) { transform: translateY(-50%); }
    .recipient-picker svg { width: 22px; height: 22px; }
    .recipient-picker { color: var(--wallet-accent); transition: background 160ms ease; }
    .recipient-picker:hover:not(:disabled) { background: color-mix(in srgb, var(--wallet-accent) 12%, transparent); }
    .recipient-picker:hover:not(:disabled) svg { animation: icon-tilt 300ms ease; }
    @keyframes icon-tilt { 0%, 100% { transform: rotate(0); } 40% { transform: rotate(-9deg); } 75% { transform: rotate(5deg); } }
    @keyframes picker-in { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    dialog {
      width: min(520px, calc(100% - 32px));
      max-height: calc(100dvh - 48px);
      box-sizing: border-box;
      padding: 22px;
      border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 20px;
      color: inherit;
      background: var(--md-sys-color-surface-container, #242126);
      box-shadow: 0 24px 80px rgb(0 0 0 / 35%);
    }
    dialog::backdrop { background: rgb(0 0 0 / 55%); }
    dialog[open] { animation: picker-in 200ms ease-out; }
    .picker-emblem { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; color: var(--wallet-accent); background: color-mix(in srgb, var(--wallet-accent) 12%, transparent); }
    .picker-emblem svg { width: 27px; height: 27px; }
    .dialog-content { display: grid; gap: 16px; }
    .dialog-heading h2 { font-size: 20px; }
    .dialog-heading button { width: auto; min-height: 40px; padding: 8px 12px; }
    .contact-list { display: grid; gap: 8px; }
    .contact-choice { display: grid; grid-template-columns: 40px minmax(0, 1fr) 20px; align-items: center; gap: 12px; text-align: left; transition: background 160ms ease, border-color 160ms ease; }
    .contact-choice:hover:not(:disabled) { background: color-mix(in srgb, var(--wallet-accent) 8%, transparent); border-color: var(--wallet-accent); }
    .contact-choice .contact-details { display: grid; gap: 4px; min-width: 0; }
    .contact-choice .contact-address { font-size: 12px; font-weight: 400; overflow-wrap: anywhere; }
    .contact-avatar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 13px; background: color-mix(in srgb, var(--wallet-accent) 14%, transparent); color: var(--wallet-accent); }
    .contact-choice svg { width: 18px; height: 18px; color: var(--wallet-accent); }
    dialog a { color: var(--md-sys-color-primary, #8dbbff); }
    .hash {
      overflow-wrap: anywhere;
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 13px;
    }
    .copy-status {
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 12px;
    }
    .muted {
      color: var(--md-sys-color-on-surface-variant, #ccc);
      font-size: 14px;
    }
    @media (max-width: 480px) {
      :host { padding: 14px 14px 24px; }
      main { gap: 14px; }
      .balance-card { padding: 14px 16px; }
      .transfer-card { gap: 16px; padding: 20px 16px; }
      .transfer-heading { gap: 11px; }
      .transfer-icon { flex-basis: 38px; width: 38px; height: 38px; }
      .actions { flex-wrap: wrap; }
      dl { grid-template-columns: 1fr; gap: 6px; }
      dd { text-align: left; margin-bottom: 8px; }
    }
    @media (prefers-reduced-motion: reduce) {
      button, .contact-choice, .recipient-picker { transition: none; }
      dialog[open], .recipient-picker:hover:not(:disabled) svg { animation: none; }
    }
  `
  render() {
    const search = this.contactSearch.trim().toLowerCase()
    const matchingContacts = this.contacts.filter((contact) => `${contact.name} ${contact.address}`.toLowerCase().includes(search))
    return html`<main>
      <header class="page-heading">
        <span class="eyebrow">${getSelectedNetwork().label} · Pay</span>
        <h1>Send LFC</h1>
        <p class="subtitle">Send testnet LFC to a wallet address.</p>
      </header>
      <section class="wallet-overview" aria-label="Wallet overview">
        <div class="balance-card">
          <div class="balance-copy">
            <span class="eyebrow">Available balance</span>
            <strong class="balance">${this.balance} <small>LFC</small></strong>
            <div class="account-row">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/>
                <path d="M4.5 20c.8-3.7 3.3-5.5 7.5-5.5s6.7 1.8 7.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              </svg>
              <span class="address" title=${this.wallet?.selectedAccount || ''}>
                ${this.wallet?.selectedAccount || 'Unlock your wallet to see its address'}
              </span>
              ${this.wallet?.selectedAccount
                ? html`<button class="copy-address" @click=${this.#copyAddress}>Copy</button>`
                : ''}
            </div>
            ${this.copyStatus ? html`<span class="copy-status" role="status">${this.copyStatus}</span>` : ''}
          </div>
        </div>
      </section>
      <section class="transfer-card">
        <div class="transfer-heading">
          <span class="transfer-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <div>
            <h2>Transfer details</h2>
            <p>Choose who to pay and how much.</p>
          </div>
        </div>
        ${this.phase === 'review'
          ? html`<p class="muted">Check these details before signing and sending.</p>
              <dl>
                <dt>Recipient</dt>
                <dd>${this.prepared.to}</dd>
                <dt>Amount</dt>
                <dd>${this.prepared.amount} LFC</dd>
                <dt>Network fee</dt>
                <dd>${this.prepared.fee} LFC</dd>
                <dt>Total</dt>
                <dd>${this.prepared.total} LFC</dd>
              </dl>
              <div class="actions">
                <button class="secondary" @click=${this.#reset}>Back</button
                ><button @click=${this.#send}>Confirm and send</button>
              </div>`
          : this.phase === 'pending' || this.phase === 'submitting'
          ? html`<div class="status-card" role="status">
              <strong>${this.phase === 'submitting' ? 'Sending transfer' : 'Transfer submitted'}</strong>
                ${this.phase === 'submitting'
                  ? 'Submitting to your node…'
                  : 'Accepted by your node. Waiting for canonical confirmation…'}
              <p class="muted">
                Confirmation requires active validators. Do not resend while this transaction is pending.
              </p>
            </div>`
          : this.phase === 'confirmed'
          ? html`<div class="status-card" role="status">
              <strong>Transfer confirmed</strong>
              <p class="muted">Your transaction is confirmed on the chain.</p>
              <button @click=${this.#reset}>New transfer</button>
            </div>`
          : html`<label for="recipient-address">Recipient address</label>
              <div class="recipient-field">
                <input
                  id="recipient-address"
                  aria-label="Recipient address"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="Enter a Leofcoin address"
                  .value=${this.to}
                  @input=${(e) => {
                    this.to = e.target.value
                    this.prepared = undefined
                  }}
                  ?disabled=${this.busy}
              />
               <button type="button" class="secondary recipient-picker" aria-haspopup="dialog"
                 aria-label="Choose from address book" title="Choose from address book"
                 @click=${this.#openContacts} ?disabled=${this.busy}>
                 <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                   <rect x="5" y="3" width="15" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/>
                   <path d="M3 7h4M3 12h4M3 17h4M9 17c.4-2 1.6-3 3.5-3s3.1 1 3.5 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                   <circle cx="12.5" cy="9" r="2.5" stroke="currentColor" stroke-width="1.7"/>
                 </svg>
               </button>
              </div>
              <label>Amount
                <div class="amount-field">
                  <input
                    aria-label="Amount in LFC"
                    inputmode="decimal"
                    autocomplete="off"
                    placeholder="0.00"
                    .value=${this.amount}
                    @input=${(e) => {
                      this.amount = e.target.value
                      this.prepared = undefined
                    }}
                    ?disabled=${this.busy}
                  />
                  <span aria-hidden="true">LFC</span>
                </div>
              </label>
              <button class="review-button" @click=${this.#review} ?disabled=${!this.status.ready || this.busy}>
                ${this.phase === 'preparing'
                  ? 'Checking transfer…'
                  : html`Review transfer
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                        <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>`}
              </button>`}
        ${this.hash ? html`<p class="hash">Transaction: ${this.hash}</p>` : ''}
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : ''}
      </section>
      <dialog aria-labelledby="contact-picker-heading"
        @keydown=${(event: KeyboardEvent) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          this.shadowRoot.querySelector('dialog').close()
        }}>
        <div class="dialog-content">
          <span class="picker-emblem" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="15" height="18" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 7h4m-4 5h4m-4 5h4m3-1c.4-2 1.4-3 3-3s2.6 1 3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="13" cy="8" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>
          </span>
          <div class="dialog-heading">
            <h2 id="contact-picker-heading">Choose recipient</h2>
            <button type="button" class="secondary" @click=${() => this.shadowRoot.querySelector('dialog').close()}>Close</button>
          </div>
          <p class="muted">${getSelectedNetwork().label} address book</p>
          <label>Search contacts
            <input type="search" autofocus aria-label="Search contacts" placeholder="Name or wallet address"
              .value=${this.contactSearch}
              @input=${(event: InputEvent) => (this.contactSearch = (event.target as HTMLInputElement).value)} />
          </label>
          ${this.contactError
            ? html`<p role="alert" class="error">${this.contactError}</p>`
            : !this.contacts.length
            ? html`<p class="muted">No saved contacts yet. Add your own address or a recipient in the address book.</p>`
            : html`<div class="contact-list">
                ${matchingContacts.map((contact) => html`<button type="button" class="secondary contact-choice"
                    @click=${() => this.#selectContact(contact)}>
                    <span class="contact-avatar" aria-hidden="true">${Array.from(contact.name)[0]?.toUpperCase()}</span>
                    <span class="contact-details"><strong>${contact.name}</strong><span class="contact-address">${contact.address}</span></span>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>`)}
                ${!matchingContacts.length
                  ? html`<p class="muted" role="status">No matching contacts.</p>` : ''}
              </div>`}
          <a href="#!/address-book" @click=${() => this.shadowRoot.querySelector('dialog').close()}>Manage address book</a>
        </div>
      </dialog>
    </main>`
  }
}

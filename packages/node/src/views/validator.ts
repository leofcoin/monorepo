import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type Client from '@leofcoin/endpoint-clients/direct'
import { errorMessage } from '../controllers/transfer.js'
import { viewHeader, viewIllustration, viewPolish } from './view-polish.js'

declare global {
  var client: Client
}

@customElement('validator-view')
export class ValidatorView extends LitElement {
  @state() accessor validators: string[] = []
  @state() accessor selectedAccount = ''
  @state() accessor loading = true
  @state() accessor participating = false
  @state() accessor loaded = false
  @state() accessor error = ''
  @state() accessor message = ''
  @state() accessor query = ''

  #request = 0

  static styles = viewPolish

  connectedCallback() {
    super.connectedCallback()
    void this.refresh()
  }

  disconnectedCallback() {
    this.#request++
    super.disconnectedCallback()
  }

  async refresh() {
    const request = ++this.#request
    this.loading = true
    this.error = ''
    try {
      const contract = await client.lookup('LeofcoinValidators')
      const [validators, account] = await Promise.all([
        client.staticCall(contract.address, 'validators', []),
        client.selectedAccount()
      ])
      if (!Array.isArray(validators) || validators.some(address => typeof address !== 'string' || !address))
        throw new Error('The node returned an invalid validator list.')
      if (typeof account !== 'string' || !account)
        throw new Error('Select a wallet account before managing participation.')
      if (request !== this.#request) return
      this.validators = validators
      this.selectedAccount = account
      this.loaded = true
    } catch (error) {
      if (request === this.#request) this.error = errorMessage(error)
    } finally {
      if (request === this.#request) this.loading = false
    }
  }

  async #participate() {
    if (this.participating || this.loading) return
    this.participating = true
    this.message = ''
    this.error = ''
    try {
      const account = await client.selectedAccount()
      if (typeof account !== 'string' || !account) throw new Error('Select a wallet account before managing participation.')
      this.selectedAccount = account
      if (!window.confirm(`Enable validator participation for ${account}? If it is not registered, this can submit approval and registration transactions and lock the required stake.`)) return
      const enabled = await client.participate(account)
      if (typeof enabled !== 'boolean') throw new Error('The node returned an unknown participation status. Refresh before trying again.')
      this.message = enabled
        ? 'Participation enabled for this node. Keep it online; this does not guarantee selection or rewards.'
        : 'Registration submitted. Wait for on-chain confirmation, refresh, then enable participation again.'
      await this.refresh()
    } catch (error) {
      this.error = errorMessage(error)
    } finally {
      this.participating = false
    }
  }

  async #copy(address: string) {
    this.error = ''
    try {
      await navigator.clipboard.writeText(address)
      this.message = 'Validator address copied.'
    } catch (error) {
      this.error = `Could not copy address: ${errorMessage(error)}`
    }
  }

  render() {
    const registered = this.validators.includes(this.selectedAccount)
    const filtered = this.validators.filter(address => address.toLowerCase().includes(this.query.toLowerCase().trim()))
    return html`<main>
      ${viewHeader('validator', 'NETWORK PARTICIPATION', 'Help secure the network', 'Explore the registered validator set and manage participation for your selected wallet account.')}
      <section class="metrics" aria-label="Validator overview">
        <article class="card metric">${viewIllustration('validator')}<span class="muted">Registered validators</span>
          <strong class=${this.loading ? 'loading' : ''}>${this.loaded ? this.validators.length : '—'}</strong></article>
        <article class="card metric">${viewIllustration('identity')}<span class="muted">Selected account</span>
          <strong class="account-status">${!this.loaded ? 'Not loaded' : registered ? 'Registered' : 'Not registered'}</strong></article>
      </section>
      <section class="card">
        <div class="section-title"><span class="avatar" aria-hidden="true">✓</span><h2>Your participation</h2></div>
        ${this.selectedAccount ? html`<p class="address">${this.selectedAccount}</p>` : ''}
        <p class="muted">Registration is on-chain membership, not proof that a validator is online. Participation runs on this node and may require stake and transaction fees.</p>
        <div class="actions">
          <button @click=${this.#participate} ?disabled=${this.participating || this.loading || !this.loaded} aria-busy=${this.participating}>
            ${this.participating ? 'Enabling participation...' : 'Enable participation'}<span aria-hidden="true">↗</span>
          </button>
          <button class="secondary" @click=${() => this.refresh()} ?disabled=${this.loading || this.participating} aria-busy=${this.loading}>${this.loading ? 'Refreshing...' : 'Refresh status'}</button>
        </div>
        <p class="feedback" role="status">${this.message}</p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
      </section>
      <section class="card">
        <div class="section-title"><h2>Registered validators</h2><span class="badge">${this.loaded ? this.validators.length : '—'}</span></div>
        ${this.loading && !this.loaded ? html`<p class="muted loading" role="status">Loading validator registry...</p>`
          : !this.loaded ? html`<p class="muted">Registry unavailable. Use Refresh status to try again.</p>`
          : !this.validators.length ? html`<div class="empty">${viewIllustration('validator')}<h3>No validators registered</h3><p class="muted">The current registry contains no validator addresses.</p></div>`
          : html`
            <label class="muted" for="validator-search">Find a validator</label>
            <input id="validator-search" type="search" placeholder="Search by public address" .value=${this.query}
              @input=${(event: InputEvent) => { this.query = (event.target as HTMLInputElement).value }}>
            ${filtered.length ? filtered.map((address, index) => html`<details>
              <summary><span class="row"><span class="avatar" aria-hidden="true">${index + 1}</span><span class="row-info">
                <code title=${address}>${address.length > 28 ? `${address.slice(0, 12)}...${address.slice(-10)}` : address}</code>
                <span class="muted">${address === this.selectedAccount ? 'Your selected account' : 'Registered validator'}</span>
              </span><span class="chevron" aria-hidden="true">›</span></span></summary>
              <div class="detail-body"><code>${address}</code><div><button class="secondary" @click=${() => this.#copy(address)}>Copy address</button></div></div>
            </details>`) : html`<p class="muted" role="status">No matching validators.</p>`}
          `}
      </section>
      <section class="card security-note"><h2>Know before you participate</h2><p class="muted">Opening this view never starts participation or submits a transaction. Review your node's network and account before enabling it.</p>
        <details><summary class="row"><span class="row-info">What this status means</span><span class="chevron" aria-hidden="true">›</span></summary>
          <div class="detail-body muted"><p>This list comes from the validator contract on your local chain. It can be incomplete while your node syncs.</p><p>Online status and rewards are not inferred from registration. Keep your node connected and synced to participate.</p></div>
        </details>
      </section>
    </main>`
  }
}

import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import networks from '@leofcoin/networks'

@customElement('testnet-faucet')
export class TestnetFaucet extends LitElement {
  @property() accessor address = ''
  @state() accessor info: any
  @state() accessor claim: any
  @state() accessor error = ''
  @state() accessor busy = false
  #timer: ReturnType<typeof setInterval>
  #checking = false
  get base() {
    return networks.leofcoin.peach.faucet
  }
  get key() {
    return `leofcoin:peach:faucet:${this.address}`
  }
  connectedCallback() {
    super.connectedCallback()
    this.#timer = setInterval(() => this.#check(), 5000)
    this.#check()
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this.#timer)
  }
  updated(changed) {
    if (changed.has('address')) {
      try {
        this.claim = JSON.parse(localStorage.getItem(this.key) || 'null')
      } catch {
        this.claim = undefined
      }
      this.error = ''
      this.#check()
    }
  }
  async #request(path, options: any = {}) {
    const address = this.address
    const response = await fetch(`${this.base}${path}`, { ...options, signal: AbortSignal.timeout(10000) })
    const data = await response.json()
    if (!response.ok) {
      if (data.claimId && address === this.address) {
        this.claim = { id: data.claimId, state: 'reserved' }
        this.#save()
      } else if (options.method === 'POST' && data.accepted === false && address === this.address) {
        this.claim = undefined
        this.#save()
      }
      throw Object.assign(new Error(data.error || `Faucet returned HTTP ${response.status}`), {
        status: response.status
      })
    }
    return data
  }
  #save() {
    try {
      if (this.claim) localStorage.setItem(this.key, JSON.stringify(this.claim))
      else localStorage.removeItem(this.key)
    } catch {}
  }
  async #check() {
    if (this.#checking || !this.address) return
    this.#checking = true
    const address = this.address
    try {
      const info = await this.#request('/status')
      if (address !== this.address) return
      if (info.network !== 'leofcoin:peach' || info.testnet !== true)
        throw new Error('Faucet is not serving the Peach testnet.')
      this.info = info
      if (this.claim?.id && ['requesting', 'reserved', 'pending'].includes(this.claim.state)) {
        let claim
        try {
          claim = await this.#request(`/claims/${this.claim.id}`)
        } catch (error) {
          if (error.status === 404 && this.claim.state === 'requesting') return
          throw error
        }
        if (address !== this.address) return
        this.claim = claim
        this.error = ''
        this.#save()
      }
    } catch {
      this.info = undefined
    } finally {
      this.#checking = false
    }
  }
  #claim = async () => {
    if (this.busy || !this.info?.ready || ['reserved', 'pending'].includes(this.claim?.state)) return
    this.busy = true
    this.error = ''
    const address = this.address
    const requestId = this.claim?.state === 'requesting' ? this.claim.id : crypto.randomUUID()
    this.claim = { id: requestId, state: 'requesting' }
    this.#save()
    try {
      const claim = await this.#request('/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, requestId })
      })
      if (address !== this.address) return
      this.claim = claim
      this.#save()
    } catch (error) {
      if (address === this.address)
        this.error = error.message || 'Faucet could not be reached. Check the status before retrying.'
    } finally {
      this.busy = false
    }
  }
  static styles = css`
    :host {
      display: grid;
      gap: 10px;
    }
    button {
      font: inherit;
      border-radius: 12px;
      padding: 12px;
      border: 1px solid transparent;
      background: var(--lfc-action, #1d64d8);
      color: var(--lfc-on-action, #ffffff);
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    p {
      margin: 0;
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .error {
      color: var(--md-sys-color-error, #ffb4ab);
    }
  `
  render() {
    const waiting = ['reserved', 'pending'].includes(this.claim?.state)
    const retrying = this.claim?.state === 'requesting'
    const cooling = this.claim?.nextClaimAt > Date.now()
    return html`<strong>Get test LFC</strong>
      <p>Free test tokens for Peach. No real monetary value. One claim per day per address and IP.</p>
      <button @click=${this.#claim} ?disabled=${!this.address || !this.info?.ready || this.busy || waiting || cooling}>
        ${this.busy
          ? 'Requesting…'
          : waiting
          ? 'Claim pending'
          : retrying
          ? 'Retry the same request safely'
          : `Request ${this.info?.amount || '10'} test LFC`}
      </button>
      ${!this.info
        ? html`<p>Faucet unavailable. It may still be starting or awaiting deployment.</p>`
        : !this.info.ready
        ? html`<p>The faucet is waiting for sync or funding.</p>`
        : ''}
      ${this.claim
        ? html`<p role="status">
              ${this.claim.state === 'confirmed'
                ? 'Test LFC confirmed. Your balance updates after your node syncs.'
                : this.claim.state === 'failed'
                ? 'Claim failed on the chain. Contact the testnet operator.'
                : this.claim.state === 'reserved'
                ? 'Claim reserved. Contact the operator if it stays here; do not resend.'
                : this.claim.state === 'requesting'
                ? 'Checking your request outcome. Retrying keeps the same claim ID and cannot create a second payout.'
                : 'Claim submitted. Waiting for canonical confirmation.'}
            </p>
            ${this.claim.hash ? html`<p>${this.claim.hash}</p>` : ''}${cooling
              ? html`<p>Next claim: ${new Date(this.claim.nextClaimAt).toLocaleString()}</p>`
              : ''}`
        : ''}
      ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : ''}`
  }
}

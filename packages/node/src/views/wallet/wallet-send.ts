import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { formatUnits } from '@leofcoin/utils'
import { prepareTransfer, submitTransfer, networkStatus, errorMessage } from '../../controllers/transfer.js'
import { saveActivity } from '../../controllers/activity.js'
import '../../elements/testnet-faucet.js'

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
      display: block;
      width: 100%;
      height: 100%;
      overflow: auto;
      color: var(--md-sys-color-on-surface, #eee);
      box-sizing: border-box;
      padding: 24px 16px;
    }
    main {
      width: 100%;
      max-width: 560px;
      margin: auto;
      display: grid;
      gap: 18px;
    }
    header,
    p,
    h1 {
      margin: 0;
    }
    h1 {
      font-size: 28px;
    }
    .muted {
      opacity: 0.75;
      font-size: 14px;
    }
    .card {
      border: 1px solid var(--md-sys-color-outline, #45505d);
      border-radius: 20px;
      padding: 22px;
      background: var(--md-sys-color-surface-container-high, #192029);
      display: grid;
      gap: 16px;
    }
    .balance {
      font-size: 28px;
      overflow-wrap: anywhere;
    }
    .address,
    .hash {
      overflow-wrap: anywhere;
      font-size: 13px;
    }
    label {
      display: grid;
      gap: 8px;
    }
    input,
    button {
      font: inherit;
      border-radius: 12px;
      padding: 12px;
      border: 1px solid var(--border-color, #45505d);
      color: inherit;
      background: transparent;
      box-sizing: border-box;
      width: 100%;
    }
    button {
      cursor: pointer;
      background: var(--md-sys-color-primary, #93b4ff);
      color: var(--md-sys-color-on-primary, #101b30);
      font-weight: 600;
    }
    button.secondary {
      background: transparent;
      color: inherit;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .error {
      color: #ffb4ab;
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
    }
    dd {
      margin: 0;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .network {
      font-size: 14px;
      border-left: 3px solid #f7c873;
      padding-left: 10px;
    }
    .network[data-ready] {
      border-color: #80d6a5;
    }
  `
  render() {
    return html`<main>
      <header>
        <p class="muted">PEACH TEST NETWORK</p>
        <h1>Your wallet</h1>
      </header>
      <section class="card">
        <span class="muted">Available balance</span><strong class="balance">${this.balance} LFC</strong>
        <span class="address">${this.wallet?.selectedAccount || 'Wallet locked'}</span>
        <p class="network" ?data-ready=${this.status.ready} role="status">
          ${this.status.label} · ${this.status.peers} peers
        </p>
        <p class="muted">Test LFC has no monetary value. Use the faucet below to fund your test wallet.</p>
      </section>
      <section class="card"><testnet-faucet .address=${this.wallet?.selectedAccount || ''}></testnet-faucet></section>
      <section class="card">
        <h2>Send LFC</h2>
        ${this.phase === 'review'
          ? html`<p>Check your transfer before signing and sending.</p>
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
          ? html`<p role="status">
                ${this.phase === 'submitting'
                  ? 'Submitting to your node…'
                  : 'Accepted by your node. Waiting for canonical confirmation…'}
              </p>
              <p class="muted">
                Confirmation requires active validators. Do not resend while this transaction is pending.
              </p>`
          : this.phase === 'confirmed'
          ? html`<p role="status">Transaction confirmed on the chain.</p>
              <button @click=${this.#reset}>New transfer</button>`
          : html`<label
                >Recipient address<input
                  autocomplete="off"
                  .value=${this.to}
                  @input=${(e) => {
                    this.to = e.target.value
                    this.prepared = undefined
                  }}
                  ?disabled=${this.busy}
              /></label>
              <label
                >Amount in LFC<input
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="0.00"
                  .value=${this.amount}
                  @input=${(e) => {
                    this.amount = e.target.value
                    this.prepared = undefined
                  }}
                  ?disabled=${this.busy}
              /></label>
              <button @click=${this.#review} ?disabled=${!this.status.ready || this.busy}>
                ${this.phase === 'preparing' ? 'Checking transfer…' : 'Review transfer'}
              </button>`}
        ${this.hash ? html`<p class="hash">Transaction: ${this.hash}</p>` : ''}
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : ''}
      </section>
    </main>`
  }
}

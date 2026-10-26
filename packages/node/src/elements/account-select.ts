import { css, customElement, html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import './address-amount.js'
import '@vandeurenglenn/lite-elements/icon.js'
import { SUPPORTED_NETWORKS } from '../network-selection.js'

type Account = [name: string, externalAddress: string, internalAddress?: string]
type Network = { key: string; label: string }

const shortAddress = (address = '') => (address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address)
const networkName = (network?: Network) => network?.label.replace(/\s*\(.*\)\s*$/, '') ?? 'Unknown network'
const isTestnet = (network?: Network) => /test/i.test(network?.label ?? '')

@customElement('account-select')
export class AccountSelect extends LiteElement {
  @property({ type: Object, consumer: true }) accessor wallet
  @property({ type: String, provider: true }) accessor selectedAccount
  @property({ type: String, reflect: true, attribute: 'network-key' }) accessor networkKey = 'peach'
  @property({ type: Boolean, reflect: true }) accessor selecting
  @property({ type: String }) accessor copied = ''

  #copyTimer: ReturnType<typeof setTimeout> | undefined

  onChange(propertyKey: string, value: any): void {
    if (propertyKey === 'wallet') this.selectedAccount = value?.accounts?.[value.selectedAccountIndex ?? 0]
  }

  get #networks(): Network[] {
    return Object.values(SUPPORTED_NETWORKS) as Network[]
  }

  get #network(): Network | undefined {
    return SUPPORTED_NETWORKS[this.networkKey]
  }

  #outside = (event: Event) => {
    if (this.selecting && !event.composedPath().includes(this)) this.selecting = false
  }

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('pointerdown', this.#outside)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('pointerdown', this.#outside)
    clearTimeout(this.#copyTimer)
  }

  #close(focusTrigger = false) {
    this.selecting = false
    if (focusTrigger) this.shadowRoot.querySelector<HTMLElement>('.trigger')?.focus()
  }

  #toggle = async (event: MouseEvent) => {
    this.selecting = !this.selecting
    // Only move focus into the menu for keyboard activation; mouse users get no focus ring.
    if (!this.selecting || event.detail !== 0) return
    await new Promise(requestAnimationFrame)
    const options = this.shadowRoot
    ;(
      options.querySelector<HTMLElement>('.account .option[aria-checked="true"]') ??
      options.querySelector<HTMLElement>('.option[aria-checked="true"]')
    )?.focus()
  }

  #selectNetwork(key: string) {
    if (key === this.networkKey) return this.#close(true)
    this.#close(true)
    this.dispatchEvent(new CustomEvent('network-change', { detail: { key }, bubbles: true, composed: true }))
  }

  #selectAccount(index: number) {
    this.#close(true)
    if (index === this.wallet?.selectedAccountIndex) return
    this.dispatchEvent(new CustomEvent('account-change', { detail: { index }, bubbles: true, composed: true }))
  }

  async #copy(event: Event, address: string) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(address)
      this.copied = address
      clearTimeout(this.#copyTimer)
      this.#copyTimer = setTimeout(() => (this.copied = ''), 1600)
    } catch {
      this.copied = ''
    }
  }

  #menuKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      return this.#close(true)
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const options = [...this.shadowRoot.querySelectorAll<HTMLElement>('.option')]
    const current = options.indexOf(this.shadowRoot.activeElement as HTMLElement)
    let next = 0
    if (event.key === 'ArrowDown') next = (current + 1) % options.length
    if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length
    if (event.key === 'End') next = options.length - 1
    event.preventDefault()
    options[next]?.focus()
  }

  static styles = [
    css`
      :host {
        --chip-mainnet: #5b9dff;
        --chip-testnet: #ff9a76;
        display: block;
        position: relative;
        min-width: 0;
        max-width: 340px;
        box-sizing: border-box;
        color: var(--md-sys-color-on-surface, #eee);
      }
      * { box-sizing: border-box; }
      button { font: inherit; color: inherit; cursor: pointer; }
      button:focus-visible { outline: 2px solid var(--md-sys-color-primary, #8bbcff); outline-offset: 2px; }
      .menu button:focus-visible { outline-offset: -2px; }

      .trigger {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 46px;
        padding: 5px 10px 5px 6px;
        border: 1px solid var(--lfc-glass-border, rgb(255 255 255 / 12%));
        border-radius: 999px;
        background: var(--lfc-glass-surface, #1b2230);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        transition: background 160ms ease, border-color 160ms ease;
      }
      .trigger:hover, :host([selecting]) .trigger {
        background: var(--md-sys-color-surface-container-high, #252d3c);
        border-color: color-mix(in srgb, var(--md-sys-color-primary, #8bbcff) 40%, transparent);
      }

      .avatar {
        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1d64d8, #2fd6c3);
        color: #fff;
        font-size: 13px;
        font-weight: 800;
      }
      .avatar.locked { background: var(--md-sys-color-surface-container-highest, #333b4a); color: var(--md-sys-color-on-surface-variant, #aab); }
      .avatar custom-icon { --custom-icon-size: 18px; }
      .net-dot {
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--md-sys-color-surface, #10141c);
        background: var(--chip-mainnet);
      }
      .net-dot.testnet { background: var(--chip-testnet); }

      .summary { display: flex; flex-direction: column; flex: 1; min-width: 0; text-align: left; line-height: 1.2; }
      .summary strong { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .summary span { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--md-sys-color-on-surface-variant, #aab); white-space: nowrap; overflow: hidden; }
      .summary address-amount { color: var(--md-sys-color-on-surface, #eee); font-weight: 600; }

      address-amount {
        display: inline-flex;
        padding: 0;
        background: transparent;
        color: inherit;
        border-radius: 0;
        font-variant-numeric: tabular-nums;
        --address-amount-font-size: 1em;
        --address-amount-font-weight: 600;
        --address-amount-align: left;
        --address-amount-min-width: 0;
        --address-amount-max-width: 110px;
      }

      .chevron { flex: 0 0 auto; --custom-icon-size: 20px; color: var(--md-sys-color-on-surface-variant, #aab); transition: transform 180ms ease; }
      :host([selecting]) .chevron { transform: rotate(180deg); }

      .menu {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        z-index: 10001;
        width: min(340px, calc(100vw - 24px));
        max-height: min(520px, 70dvh);
        overflow: auto;
        padding: 8px;
        border: 1px solid var(--lfc-glass-border, rgb(255 255 255 / 12%));
        border-radius: 22px;
        background: color-mix(in srgb, var(--md-sys-color-surface-container, #161c27) 92%, transparent);
        backdrop-filter: blur(24px) saturate(1.2);
        -webkit-backdrop-filter: blur(24px) saturate(1.2);
        box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
        transform-origin: top right;
        animation: pop 160ms cubic-bezier(.2, .8, .2, 1);
      }
      @keyframes pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } }

      .section-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 6px 10px 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant, #aab);
      }

      .networks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 2px 4px; }
      .network {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 8px 10px;
        border: 1px solid var(--lfc-glass-border, rgb(255 255 255 / 10%));
        border-radius: 14px;
        background: transparent;
        text-align: left;
        transition: background 140ms ease, border-color 140ms ease;
      }
      .network:hover { background: var(--md-sys-color-surface-container-high, #252d3c); }
      .network[aria-checked='true'] {
        border-color: color-mix(in srgb, var(--md-sys-color-primary, #8bbcff) 70%, transparent);
        background: color-mix(in srgb, var(--md-sys-color-primary, #8bbcff) 12%, transparent);
      }
      .network .dot { width: 10px; height: 10px; flex: 0 0 auto; border-radius: 50%; background: var(--chip-mainnet); }
      .network .dot.testnet { background: var(--chip-testnet); }
      .network span { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
      .network strong { font-size: 13px; font-weight: 700; }
      .network small { font-size: 11px; color: var(--md-sys-color-on-surface-variant, #aab); }

      hr { margin: 8px 6px; border: 0; border-top: 1px solid var(--lfc-glass-border, rgb(255 255 255 / 10%)); }

      .account {
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: 14px;
        padding: 2px 4px 2px 0;
        transition: background 140ms ease;
      }
      .account:hover, .account:focus-within { background: var(--md-sys-color-surface-container-high, #252d3c); }
      .account.selected { background: color-mix(in srgb, var(--md-sys-color-primary, #8bbcff) 10%, transparent); }
      .account .option {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        min-height: 52px;
        padding: 6px 8px;
        border: 0;
        border-radius: 14px;
        background: transparent;
        text-align: left;
      }
      .account .avatar { width: 32px; height: 32px; font-size: 12px; }
      .account .summary strong { font-size: 13.5px; }
      .check { --custom-icon-size: 18px; color: var(--md-sys-color-primary, #8bbcff); flex: 0 0 auto; }
      .icon-button {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--md-sys-color-on-surface-variant, #aab);
      }
      .icon-button:hover { background: var(--md-sys-color-surface-container-highest, #333b4a); color: var(--md-sys-color-on-surface, #eee); }
      .icon-button custom-icon { --custom-icon-size: 18px; }
      .icon-button.copied { color: #2fd6c3; }

      .locked-note { margin: 4px 10px 8px; font-size: 12.5px; line-height: 1.4; color: var(--md-sys-color-on-surface-variant, #aab); }
      .hint { margin: 2px 10px 4px; font-size: 11px; line-height: 1.4; color: var(--md-sys-color-on-surface-variant, #aab); }

      @media (max-width: 639px) {
        .menu { width: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .menu { animation: none; }
        .trigger, .chevron, .network, .account { transition: none; }
      }
    `
  ]

  #initials(name = '') {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'W'
    )
  }

  render() {
    const network = this.#network
    const testnet = isTestnet(network)
    const account: Account | undefined = this.selectedAccount
    return html`
      <button
        class="trigger"
        aria-haspopup="menu"
        aria-expanded=${String(Boolean(this.selecting))}
        aria-controls="wallet-menu"
        aria-label=${account
          ? `${account[0]} on ${networkName(network)}. Switch account or network`
          : `Wallet locked on ${networkName(network)}. Switch network`}
        @click=${this.#toggle}
        @keydown=${(event: KeyboardEvent) => event.key === 'Escape' && this.#close()}>
        <span class="avatar ${account ? '' : 'locked'}" aria-hidden="true">
          ${account ? this.#initials(account[0]) : html`<custom-icon icon="lock"></custom-icon>`}
          <span class="net-dot ${testnet ? 'testnet' : ''}"></span>
        </span>
        <span class="summary">
          <strong>${account ? account[0] : 'Wallet locked'}</strong>
          <span>
            ${networkName(network)}${account
              ? html` · <address-amount .address=${account[1]}></address-amount>`
              : ''}
          </span>
        </span>
        <custom-icon class="chevron" icon="expand_more" aria-hidden="true"></custom-icon>
      </button>

      ${this.selecting
        ? html`
            <div class="menu" id="wallet-menu" role="menu" aria-label="Wallet and network" @keydown=${this.#menuKeydown}>
              <div class="section-label" id="network-label">Network</div>
              <div class="networks" role="group" aria-labelledby="network-label">
                ${map(
                  this.#networks,
                  (item) => html`
                    <button
                      class="network option"
                      role="menuitemradio"
                      aria-checked=${String(item.key === this.networkKey)}
                      @click=${() => this.#selectNetwork(item.key)}>
                      <span class="dot ${isTestnet(item) ? 'testnet' : ''}" aria-hidden="true"></span>
                      <span>
                        <strong>${networkName(item)}</strong>
                        <small>${isTestnet(item) ? 'Testnet' : /experimental/i.test(item.label) ? 'Experimental' : 'Mainnet'}</small>
                      </span>
                    </button>
                  `
                )}
              </div>
              <p class="hint">Switching restarts the browser node. Your wallet stays the same.</p>
              <hr />
              <div class="section-label" id="accounts-label">
                <span>Accounts</span>
                ${this.wallet?.accounts ? html`<span>${this.wallet.accounts.length}</span>` : ''}
              </div>
              ${this.wallet?.accounts
                ? html`<div role="group" aria-labelledby="accounts-label">
                    ${map(this.wallet.accounts as Account[], (item, index) => {
                      const selected = index === (this.wallet.selectedAccountIndex ?? 0)
                      const copied = this.copied === item[1]
                      return html`
                        <div class="account ${selected ? 'selected' : ''}">
                          <button
                            class="option"
                            role="menuitemradio"
                            aria-checked=${String(selected)}
                            title=${item[1]}
                            @click=${() => this.#selectAccount(index)}>
                            <span class="avatar" aria-hidden="true">${this.#initials(item[0])}</span>
                            <span class="summary">
                              <strong>${item[0]}</strong>
                              <span>${shortAddress(item[1])} · <address-amount .address=${item[1]}></address-amount></span>
                            </span>
                            ${selected ? html`<custom-icon class="check" icon="check" aria-hidden="true"></custom-icon>` : ''}
                          </button>
                          <button
                            class="icon-button ${copied ? 'copied' : ''}"
                            aria-label=${copied ? `Address of ${item[0]} copied` : `Copy address of ${item[0]}`}
                            title=${copied ? 'Copied' : 'Copy address'}
                            @click=${(event: Event) => this.#copy(event, item[1])}>
                            <custom-icon icon=${copied ? 'check' : 'content_copy'} aria-hidden="true"></custom-icon>
                          </button>
                        </div>
                      `
                    })}
                  </div>`
                : html`<p class="locked-note">Unlock your wallet to see and switch accounts.</p>`}
            </div>
          `
        : ''}
    `
  }
}

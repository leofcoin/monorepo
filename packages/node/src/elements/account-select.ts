import { css, customElement, html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import './very-short-string.js'
import './address-amount.js'
import './../animations/busy.js'
import '@vandeurenglenn/lite-elements/icon.js'

@customElement('account-select')
export class AccountSelect extends LiteElement {
  @property({ type: Object, consumer: true }) accessor wallet
  @property({ type: String, provider: true }) accessor selectedAccount
  @property({ type: Boolean, reflect: true }) accessor selecting

  onChange(propertyKey: string, value: any): void {
    if (propertyKey === 'wallet' && value) {
      this.selectedAccount = value.accounts[value.selectedAccountIndex]
    }
  }

  get #iconElement() {
    return this.shadowRoot.querySelector('.account-trigger custom-icon') as HTMLElement
  }

  #outside = (event: Event) => {
    if (!event.composedPath().includes(this)) this.selecting = false
  }

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('pointerdown', this.#outside)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('pointerdown', this.#outside)
  }

  select = async () => {
    if (this.wallet) this.selecting = !this.selecting
  }

  static styles = [
    css`
      :host {
        display: block;
        flex-direction: column;
        min-width: 0;
        max-width: 320px;
        width: 100%;
        position: relative;
        box-sizing: border-box;
      }
      flex-row {
        width: 100%;
        justify-content: space-between;
        align-items: center;
        min-height: 100%;
      }
      custom-svg-icon {
        pointer-events: auto;
        cursor: pointer;
      }

      address-amount {
        padding: 4px 8px 4px 4px;
      }

      .selected-container {
        align-items: center;
        background: var(--secondary-background);
        border-radius: var(--md-sys-shape-corner-medium);
        box-sizing: border-box;
        padding: 4px;
      }
      .account-trigger {
        display: flex; gap: 8px; width: 100%; min-height: 44px;
        border: 1px solid var(--lfc-glass-border, #51474e);
        color: var(--md-sys-color-on-surface, #eee);
        background: var(--lfc-glass-surface, #242126);
        font: inherit; cursor: pointer;
      }
      .account-trigger:hover { background: var(--md-sys-color-surface-container-high); }
      button:focus-visible { outline: 2px solid var(--md-sys-color-primary, #3477d2); outline-offset: 2px; }
      .account-trigger custom-icon { flex-shrink: 0; --custom-icon-size: 18px; }
      .account-trigger p { flex: 1; min-width: 0; margin: 0; padding-left: 6px; text-transform: none; }
      .account-trigger address-amount { flex-shrink: 0; }
      .copy-button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: inherit; cursor: pointer; }
      .copy-button:hover { background: var(--md-sys-color-surface-container-highest); }

      .accounts-container {
        margin-top: 12px;
        position: absolute;
        background: var(--lfc-glass-surface, #242126);
        color: var(--md-sys-color-on-surface, #eee);
        border: 1px solid var(--lfc-glass-border, #51474e);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow: 0 16px 40px rgb(0 0 0 / 20%);
        border-radius: 20px;
        box-sizing: border-box;
        padding: 6px 12px 6px 6px;
        z-index: 10001;
        right: 0;
        left: auto;
        max-width: 320px;
        width: min(320px, calc(100vw - 24px));
        top: 100%;
        max-height: min(420px, 60dvh);
        overflow: auto;
      }

      .account-container {
        max-width: 320px;
        width: 100%;
        padding: 6px 12px;
        border-radius: 12px;
        box-sizing: border-box;
        margin: 6px 0;
        align-items: center;
      }

      very-short-string {
        padding: 0 12px;
      }

      p {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 180px;
        direction: rtl;
        margin-right: 12px;
      }
    `
  ]

  #copy(e, text) {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    this.#iconElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], {
      duration: 300,
      easing: 'ease-in-out',
      fill: 'forwards'
    })
  }

  render() {
    return html`
      <button class="selected-container account-trigger" aria-label="View wallet accounts" aria-expanded=${String(Boolean(this.selecting))}
        aria-controls="wallet-accounts" @click=${() => this.select()}
        @keydown=${(event: KeyboardEvent) => { if (event.key === 'Escape') this.selecting = false }}>
        ${this.selectedAccount
          ? html`
              <p>${this.selectedAccount[1]}</p>

              <address-amount .address=${this.selectedAccount[1]}></address-amount>
            `
          : html`<busy-animation></busy-animation>`}

        <custom-icon icon=${this.selecting ? 'arrow_drop_up' : 'arrow_drop_down'} aria-hidden="true"></custom-icon>
      </button>

      ${this.selecting
        ? html`
            <flex-column class="accounts-container" id="wallet-accounts" role="region" aria-label="Wallet accounts"
              @keydown=${(event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  this.selecting = false
                  this.shadowRoot.querySelector<HTMLElement>('.account-trigger')?.focus()
                }
              }}>
              ${map(
                this.wallet.accounts,
                (item) => html`
                  <flex-column class="account-container">
                    <flex-row center>
                      <strong>${item[0]}</strong>
                      <flex-it></flex-it>
                      <very-short-string value=${item[1]}></very-short-string>
                    </flex-row>
                    <flex-row>
                      <address-amount .address=${item[1]}></address-amount>
                      <button class="copy-button" aria-label=${`Copy address for ${item[0]}`}
                        @click=${(e) => this.#copy(e, item[1])}><custom-icon icon="content_copy" aria-hidden="true"></custom-icon></button>
                    </flex-row>
                  </flex-column>
                `
              )}
            </flex-column>
          `
        : ''}
    `
  }
}

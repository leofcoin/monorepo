import { css, customElement, html, LiteElement, property } from '@vandeurenglenn/lite'
import { map } from 'lit/directives/map.js'
import './very-short-string.js'
import './address-amount.js'
import './../animations/busy.js'
import '@vandeurenglenn/lite-elements/icon-button.js'
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
    return this.shadowRoot.querySelector('custom-icon-button') as HTMLElement
  }

  // async connectedCallback() {
  //   pubsub.subscribe('identity-change', this.#identityChange.bind(this))
  // }

  // /**
  //  *
  //  * @param {Array} accounts
  //  * @param {Number} selectedAaccount
  //  */
  // async #identityChange({ accounts, selectedAccountIndex }) {
  //   this.accounts = accounts
  //   this.selected = accounts[selectedAccountIndex]
  //   this.title = this.selected[1]
  //   // if (!this.selected)
  //   console.log({ accounts, selectedAccountIndex })
  // }

  select = async () => {
    if (this.selecting) {
      this.selecting = false
      return
    }
    this.selecting = true

    await this.requestRender()
    const { top, left, width } = this.getBoundingClientRect()
    this.shadowRoot.querySelector('.accounts-container').style.top = `${top + 48}px`
    // this.shadowRoot.querySelector('.accounts-container').style.left = `${left - width / 2 + 40}px`
  }

  static styles = [
    css`
      :host {
        display: block;
        flex-direction: column;
        min-width: 210px;
        height: 100%;
        max-width: 320px;
        width: 100%;
        position: relative;
        box-sizing: border-box;
      }
      .hover {
        position: absolute;
        inset: 0;
        background-color: var(--md-sys-color-primary);
        opacity: 0;
        transition: opacity 200ms;
        border-radius: var(--md-sys-shape-corner-medium);
      }

      :host(:focus) .hover,
      :host(:hover) .hover {
        opacity: 0.1;
      }

      :host(:active) .hover {
        opacity: 0.2;
      }

      custom-icon-button {
        transition: transform ease-in-out 0.25s;
      }

      :host([selecting]) custom-icon-button {
        transform: rotate(180deg);
        transition: transform ease-in-out 0.25s;
      }

      flex-row {
        width: 100%;
        justify-content: space-between;
        align-items: center;
        min-height: 100%;
        cursor: pointer;
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

      .seperator {
        display: flex;
        height: 12px;
      }

      .accounts-container {
        margin-top: 12px;
        position: absolute;
        background: var(--md-sys-color-surface-container-high);
        color: var(--md-sys-color-on-surface-container-high);
        border-radius: 24px;
        box-sizing: border-box;
        padding: 6px 12px 6px 6px;
        z-index: 10001;
        right: 0;
        left: auto;
        max-width: 320px;
      }

      .account-container {
        max-width: 320px;
        width: 100%;
        padding: 6px 12px;
        border-radius: 12px;
        box-sizing: border-box;
        margin: 6px 0;
        cursor: pointer;
        align-items: center;
      }

      very-short-string {
        padding: 0 12px;
      }

      custom-icon-button {
        color: var(--md-sys-color-on-surface);
        --custom-icon-size: 18px;
        margin-left: 6px;
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
    this.#iconElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], {
      duration: 300,
      easing: 'ease-in-out',
      fill: 'forwards'
    })
  }

  render() {
    return html`
      <flex-row class="selected-container" @click=${() => this.select()}>
        <div class="hover"></div>
        ${this.selectedAccount
          ? html`
              <p>${this.selectedAccount[1]}</p>

              <flex-it></flex-it>
              <address-amount .address=${this.selectedAccount[1]}></address-amount>
            `
          : html`<busy-animation></busy-animation>`}

        <custom-icon-button icon="arrow_drop_down"></custom-icon-button>
      </flex-row>

      ${this.selecting
        ? html`
            <span class="seperator"></span>
            <flex-column class="accounts-container">
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
                      <custom-icon-button
                        icon="content_copy"
                        @click=${(e) => this.#copy(e, item[1])}></custom-icon-button>
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

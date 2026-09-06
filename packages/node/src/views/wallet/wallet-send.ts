import { CSSResultGroup, LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('wallet-send')
export class WalletSend extends LitElement {
  @property()
  accessor amount = ''

  @property()
  accessor to = ''

  static styles?: CSSResultGroup = [
    css`
      :host {
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
        display: flex;
        flex-direction: column;
      }
      flex-row {
        width: 100%;
      }
      .container {
        border-radius: 24px;
        padding: 24px;
        box-sizing: border-box;
        background: var(--secondary-background);
        color: var(--font-color);
        border: 1px solid var(--border-color);
        font-size: 18px;
        width: 100%;
        max-width: 320px;
      }
      input {
        margin-top: 12px;
        margin-bottom: 24px;
        box-sizing: border-box;
        width: 100%;
      }
      select,
      input,
      button {
        pointer-events: auto;
        background: var(--md-sys-color-surface-container-highest);
        border: 1px solid var(--border-color);
        font-size: 14px;
        color: var(--md-sys-color-on-surface-container-highest);
        border-radius: 24px;
        padding: 6px 12px;
      }
      select,
      button {
        cursor: pointer;
      }

      label {
        width: 100%;
      }
    `
  ]

  protected render() {
    return html`
      <hero-element>
        <flex-row>
          <label for=".amount">send</label>
          <flex-it></flex-it>
          <select>
            <option>LFC</option>
          </select>
        </flex-row>
        <input class="amount" placeholder="1" value=${this.amount} />
        <label for=".to">to</label>
        <input class="to" placeholder="address" value=${this.to} />
        <flex-it></flex-it>
        <flex-row>
          <custom-button data-action="cancel" label="cancel">cancel</custom-button>
          <flex-it></flex-it>
          <custom-button data-action="requestSend" label="send" type="tonal"></custom-button>
        </flex-row>
      </hero-element>
    `
  }
}

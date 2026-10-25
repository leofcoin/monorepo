import { css, html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import '@vandeurenglenn/lite-elements/icon.js'

@customElement('notification-child')
export class NotificationChild extends LitElement {
  @property() accessor title = ''
  @property() accessor message = ''
  @property({ reflect: true }) accessor type: 'error' | 'info' | 'warning' = 'info'
  #hovered = false
  #focused = false

  #interaction() {
    this.dispatchEvent(new CustomEvent(this.#hovered || this.#focused ? 'notification-pause' : 'notification-resume'))
  }

  static styles = css`
    :host {
      display: block; flex-shrink: 0; font-size: 14px; padding: 16px;
      border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 18px;
      color: var(--md-sys-color-on-surface, #eee);
      background: var(--lfc-glass-surface, #242126);
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      box-sizing: border-box; overflow-wrap: anywhere;
    }
    .heading { display: flex; align-items: start; gap: 10px; }
    .kind { color: var(--md-sys-color-primary, #3477d2); padding-top: 2px; }
    :host([type='error']) .kind { color: var(--md-sys-color-error, #ffb4ab); }
    :host([type='warning']) .kind { color: #f7c873; }
    strong { flex: 1; font-size: 14px; line-height: 24px; }
    p { margin: 8px 0 0 34px; line-height: 1.6; color: var(--md-sys-color-on-surface-variant, #ccc); white-space: pre-wrap; }
    button { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; margin: -10px -10px -6px 0; border: 0; border-radius: 10px; background: transparent; color: inherit; cursor: pointer; }
    button:hover { background: var(--md-sys-color-surface-container-high, #383139); }
    button:focus-visible { outline: 2px solid var(--md-sys-color-primary, #3477d2); outline-offset: 2px; }
  `

  render() {
    return html`<article
      @pointerenter=${() => { this.#hovered = true; this.#interaction() }}
      @pointerleave=${() => { this.#hovered = false; this.#interaction() }}
      @focusin=${() => { this.#focused = true; this.#interaction() }}
      @focusout=${() => { this.#focused = false; this.#interaction() }}>
      <div class="heading">
        <custom-icon class="kind" icon=${this.type === 'info' ? 'notifications' : this.type === 'error' ? 'error' : 'warning'} aria-hidden="true"></custom-icon>
        <strong>${this.title}</strong>
        <button aria-label=${`Dismiss ${this.title || 'notification'}`}
          @click=${() => this.dispatchEvent(new CustomEvent('notification-dismiss', { bubbles: true, composed: true }))}>
          <custom-icon icon="close" aria-hidden="true"></custom-icon>
        </button>
      </div>
      <p>${this.message}</p>
    </article>`
  }
}
